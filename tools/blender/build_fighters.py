"""Gera os lutadores do Toon Clash no Blender e exporta como .glb.

Uso (na raiz do projeto):
    blender --background --factory-startup --python tools/blender/build_fighters.py -- \
        tools/blender/looks.json public/assets/fighters [kai nyx ...]

Cada lutador é montado a partir de src/characters/<id>/look.ts (via looks.json), com as partes
nomeadas no padrão de docs/MODELOS-3D.md. As coordenadas no código seguem o jogo (Three.js):
+X para a frente, +Y para cima, +Z para a câmera. O helper `b()` converte para o Blender (Z para cima).
"""

import json
import math
import os
import sys

import bmesh
import bpy

THIGH = 0.42
SHIN = 0.40


# ---------------------------------------------------------------------------
# Conversões e materiais
# ---------------------------------------------------------------------------


def b(x, y, z):
    """Posição do jogo (Y para cima) -> Blender (Z para cima)."""
    return (x, -z, y)


def b_rot(rx=0.0, ry=0.0, rz=0.0):
    """Rotação em torno dos eixos do jogo -> Euler do Blender."""
    return (rx, -rz, ry)


def b_scale(sx=1.0, sy=1.0, sz=1.0):
    return (sx, sz, sy)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(color):
    r = ((color >> 16) & 255) / 255
    g = ((color >> 8) & 255) / 255
    bl = (color & 255) / 255
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(bl), 1.0)


def darker(color, k=0.6):
    r = int(((color >> 16) & 255) * k)
    g = int(((color >> 8) & 255) * k)
    bl = int((color & 255) * k)
    return (r << 16) | (g << 8) | bl


_materials = {}


def material(color, glow=False):
    key = (color, glow)
    if key in _materials:
        return _materials[key]
    mat = bpy.data.materials.new(f"c{color:06x}{'_glow' if glow else ''}")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    rgba = hex_rgb(color)
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = 0.65
    if glow:
        bsdf.inputs["Emission Color"].default_value = rgba
        bsdf.inputs["Emission Strength"].default_value = 1.0
    _materials[key] = mat
    return mat


# ---------------------------------------------------------------------------
# Primitivas (bmesh, sem depender de contexto de viewport)
# ---------------------------------------------------------------------------


def _object(name, bm, parent, pos, color, glow=False, rot=(0, 0, 0), scale=(1, 1, 1), smooth=True, subdiv=0, bevel=0.0):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(material(color, glow))
    obj.parent = parent
    obj.location = b(*pos)
    obj.rotation_euler = b_rot(*rot)
    obj.scale = b_scale(*scale)
    if bevel > 0:
        mod = obj.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
    if subdiv > 0:
        mod = obj.modifiers.new("subdiv", "SUBSURF")
        mod.levels = subdiv
        mod.render_levels = subdiv
    return obj


def sphere(name, r, parent, pos, color, glow=False, scale=(1, 1, 1), segs=16, rings=12, subdiv=0):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    return _object(name, bm, parent, pos, color, glow, scale=scale, subdiv=subdiv)


def hemisphere(name, r, parent, pos, color, glow=False, rot=(0, 0, 0), scale=(1, 1, 1)):
    """Metade de cima de uma esfera (no espaço do jogo, y >= 0)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=18, v_segments=12, radius=r)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-5], context="VERTS")
    return _object(name, bm, parent, pos, color, glow, rot=rot, scale=scale)


def capsule(name, r, length, parent, pos, color, glow=False, scale=(1, 1, 1), segs=16):
    """Cápsula vertical (eixo Y do jogo)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=12, radius=r)
    for v in bm.verts:
        if v.co.z > 1e-6:
            v.co.z += length / 2
        elif v.co.z < -1e-6:
            v.co.z -= length / 2
    return _object(name, bm, parent, pos, color, glow, scale=scale)


def cone(name, r_bottom, r_top, h, parent, pos, color, glow=False, rot=(0, 0, 0), segs=12, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r_bottom, radius2=r_top, depth=h)
    return _object(name, bm, parent, pos, color, glow, rot=rot, smooth=smooth)


def box(name, w, h, d, parent, pos, color, glow=False, rot=(0, 0, 0), bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= w
        v.co.y *= d
        v.co.z *= h
    return _object(name, bm, parent, pos, color, glow, rot=rot, smooth=bevel > 0, bevel=bevel)


def ring(name, radius, thickness, parent, pos, color, glow=False, rot=(0, 0, 0), arc=math.tau, scale=(1, 1, 1)):
    """Anel horizontal (deitado no plano XZ do jogo)."""
    bm = bmesh.new()
    major, minor = 24, 8
    steps = major if arc >= math.tau else major + 1
    rings_ = []
    for i in range(steps):
        a = arc * i / major
        center = (math.cos(a) * radius, math.sin(a) * radius)
        verts = []
        for j in range(minor):
            t = math.tau * j / minor
            k = radius + math.cos(t) * thickness
            verts.append(bm.verts.new((math.cos(a) * k, math.sin(a) * k, math.sin(t) * thickness)))
        rings_.append(verts)
        del center
    count = len(rings_) if arc >= math.tau else len(rings_) - 1
    for i in range(count):
        a_ring = rings_[i]
        b_ring = rings_[(i + 1) % len(rings_)]
        for j in range(minor):
            bm.faces.new((a_ring[j], a_ring[(j + 1) % minor], b_ring[(j + 1) % minor], b_ring[j]))
    return _object(name, bm, parent, pos, color, glow, rot=rot, scale=scale)


def empty(name, parent, pos, scale=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = b(*pos)
    if scale:
        obj.scale = b_scale(*scale)
    return obj


def loft(name, rings, parent, pos, color, glow=False, segs=18, sq=2.0, pole_bottom=None, pole_top=None,
         cap_bottom=False, cap_top=False, subdiv=0, scale=(1, 1, 1)):
    """Malha "torneada" por anéis (y, rx, rz) de baixo para cima, no espaço do jogo.

    rx é a meia-profundidade (eixo X, frente) e rz a meia-largura (eixo Z). `sq` > 2 deixa a seção
    mais quadrada (superelipse). Os polos fecham as pontas arredondadas; `cap_*` fecha reto.
    """
    bm = bmesh.new()
    loops = []
    e = 2.0 / sq
    for (y, rx, rz) in rings:
        ring_verts = []
        for j in range(segs):
            a = math.tau * j / segs
            c, sn = math.cos(a), math.sin(a)
            x = math.copysign(abs(c) ** e, c) * rx
            z = math.copysign(abs(sn) ** e, sn) * rz
            ring_verts.append(bm.verts.new(b(x, y, z)))
        loops.append(ring_verts)
    for i in range(len(loops) - 1):
        lo, hi = loops[i], loops[i + 1]
        for j in range(segs):
            k = (j + 1) % segs
            bm.faces.new((lo[j], lo[k], hi[k], hi[j]))
    for pole_y, ring_verts, cap in ((pole_bottom, loops[0], cap_bottom), (pole_top, loops[-1], cap_top)):
        if pole_y is not None:
            pole = bm.verts.new(b(0, pole_y, 0))
            for j in range(segs):
                bm.faces.new((ring_verts[j], ring_verts[(j + 1) % segs], pole))
        elif cap:
            bm.faces.new(ring_verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _object(name, bm, parent, pos, color, glow, scale=scale, subdiv=subdiv)


def dome(y0, rx, rz, h, direction, n=4):
    """Anéis de uma ponta arredondada a partir de y0 (direction +1 sobe, -1 desce), sem o polo."""
    out = []
    for k in range(1, n + 1):
        th = k / (n + 1) * math.pi / 2
        out.append((y0 + direction * h * math.sin(th), rx * math.cos(th), rz * math.cos(th)))
    return out if direction > 0 else list(reversed(out))


def taper(name, r_top, r_bot, length, parent, pos, color, glow=False, segs=14, depth=1.0):
    """Membro de desenho animado: cápsula que afina (ou alarga) de cima para baixo."""
    half = length / 2
    rings = dome(-half, r_bot * depth, r_bot, r_bot, -1)
    rings += [(-half, r_bot * depth, r_bot), (half, r_top * depth, r_top)]
    rings += dome(half, r_top * depth, r_top, r_top, 1)
    return loft(name, rings, parent, pos, color, glow, segs=segs, pole_bottom=-half - r_bot, pole_top=half + r_top)


# ---------------------------------------------------------------------------
# Detalhes de roupa: preenchimentos chapados e traços de nanquim colados na superfície.
# Levam o prefixo "flat:" — o jogo não põe contorno de casca neles (o contorno faria um risco
# grosso e torto em volta de cada detalhe pequeno; era isso que deixava gola, barra e punhos
# "bugados"). Quem desenha a borda é o traço de nanquim.
# ---------------------------------------------------------------------------

INK = 0x15101C
FLAT = "flat:"


def _sub(p, q):
    return (p[0] - q[0], p[1] - q[1], p[2] - q[2])


def _cross(p, q):
    return (p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0])


def _norm(p):
    n = math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]) or 1.0
    return (p[0] / n, p[1] / n, p[2] / n)


def _flat_object(name, bm, parent, color, glow=False):
    return _object(FLAT + name, bm, parent, (0, 0, 0), color, glow, smooth=True)


def torso_at(look, t, bk, grow):
    """Ponto (e normal) na superfície do tronco: altura u (unidades do tronco) e ângulo a
    (0 = frente, +pi/2 = lado da câmera), afastado `off` para fora."""
    prof = body_profile(look)
    p, depth = prof["sq"], prof["depth"]
    e = 2.0 / p

    def at(u, a, off=0.0):
        hw = half_width(look, u) * bk * grow
        rx, rz = hw * depth, hw
        c, s = math.cos(a), math.sin(a)
        x = math.copysign(abs(c) ** e, c) * rx
        z = math.copysign(abs(s) ** e, s) * rz
        nx = math.copysign(abs(x / rx) ** (p - 1), x) / rx
        nz = math.copysign(abs(z / rz) ** (p - 1), z) / rz
        n = _norm((nx, 0.0, nz))
        return (x + n[0] * off, u * t, z + n[2] * off), n

    return at


def limb_at(cy, half, r_top, r_bot):
    """Ponto (e normal) num membro feito com `taper` centrado em (0, cy, 0): altura y no espaço do pai."""

    def at(y, a, off=0.0):
        k = min(1.0, max(0.0, (y - (cy - half)) / (2 * half)))
        r = r_bot + (r_top - r_bot) * k + off
        n = (math.cos(a), 0.0, math.sin(a))
        return (n[0] * r, y, n[2] * r), n

    return at


def ink(name, samples, parent, width=0.013, color=INK, closed=False):
    """Traço de nanquim: fita fina colada na superfície. `samples` = [(ponto, normal), ...]."""
    bm = bmesh.new()
    n = len(samples)
    left, right = [], []
    for i, (pt, nrm) in enumerate(samples):
        if closed:
            prev, nxt = samples[(i - 1) % n][0], samples[(i + 1) % n][0]
        else:
            prev, nxt = samples[max(i - 1, 0)][0], samples[min(i + 1, n - 1)][0]
        side = _norm(_cross(nrm, _sub(nxt, prev)))
        h = width / 2
        left.append(bm.verts.new(b(pt[0] + side[0] * h, pt[1] + side[1] * h, pt[2] + side[2] * h)))
        right.append(bm.verts.new(b(pt[0] - side[0] * h, pt[1] - side[1] * h, pt[2] - side[2] * h)))
    for i in range(n if closed else n - 1):
        j = (i + 1) % n
        bm.faces.new((left[i], right[i], right[j], left[j]))
    return _flat_object(name, bm, parent, color)


def patch(name, at, u0, u1, a0, a1, color, parent, off, nu=4, na=8, wrap=False):
    """Preenchimento chapado na superfície (bolso, faixa, gola, remendo)."""
    bm = bmesh.new()
    cols = na if wrap else na + 1
    grid = []
    for i in range(nu + 1):
        u = u0 + (u1 - u0) * i / nu
        row = []
        for j in range(cols):
            a = a0 + (a1 - a0) * j / na
            row.append(bm.verts.new(b(*at(u, a, off)[0])))
        grid.append(row)
    for i in range(nu):
        for j in range(na):
            k = (j + 1) % cols
            if not wrap and j + 1 >= cols:
                continue
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][k], grid[i][k]))
    return _flat_object(name, bm, parent, color)


def ring_line(name, at, u, parent, off, width=0.013, color=INK, segs=28):
    """Traço que dá a volta inteira (barra, punho, gola)."""
    return ink(name, [at(u, math.tau * i / segs, off) for i in range(segs)], parent, width, color, closed=True)


def border(name, at, u0, u1, a0, a1, parent, off, width=0.011, steps=6):
    """Contorno de nanquim de um retângulo na superfície (bolso, remendo)."""
    pts = [at(u0, a0 + (a1 - a0) * i / steps, off) for i in range(steps)]
    pts += [at(u0 + (u1 - u0) * i / steps, a1, off) for i in range(steps)]
    pts += [at(u1, a1 - (a1 - a0) * i / steps, off) for i in range(steps)]
    pts += [at(u1 - (u1 - u0) * i / steps, a0, off) for i in range(steps)]
    return ink(name, pts, parent, width, closed=True)


def zigzag(name, at, u, depth_, a0, a1, teeth, color, parent, off):
    """Barra rasgada: dentes chapados pendurados abaixo de u, com o traço do zigue-zague."""
    bm = bmesh.new()
    line = []
    for k in range(teeth):
        a_l = a0 + (a1 - a0) * k / teeth
        a_r = a0 + (a1 - a0) * (k + 1) / teeth
        a_m = (a_l + a_r) / 2
        drop = depth_ * (0.7 + 0.3 * ((k * 7) % 3) / 2)
        p_l, p_r, p_m = at(u, a_l, off), at(u, a_r, off), at(u - drop, a_m, off)
        # Ordem l, r, m: a face olha para fora (para a câmera).
        bm.faces.new((bm.verts.new(b(*p_l[0])), bm.verts.new(b(*p_r[0])), bm.verts.new(b(*p_m[0]))))
        line += [at(u, a_l, off + 0.002), at(u - drop, a_m, off + 0.002)]
    _flat_object(name, bm, parent, color)
    closed = abs((a1 - a0) - math.tau) < 1e-6
    if not closed:
        line.append(at(u, a1, off + 0.002))
    return ink(name + "Ink", line, parent, 0.012, closed=closed)


# ---------------------------------------------------------------------------
# Formas (linguagem de formas de cada lutador)
# ---------------------------------------------------------------------------

# Perfis do tronco: pontos (y em unidades do tronco, meia-largura em unidades de "bulk"),
# proporção da profundidade e quadratura da seção. A silhueta é o que se lê de longe na luta.
BODIES = {
    "standard": {"pts": [(-0.10, 0.14), (0.02, 0.19), (0.18, 0.175), (0.34, 0.21), (0.46, 0.22), (0.56, 0.11)], "depth": 0.74, "sq": 2.2},
    "wedge": {"pts": [(-0.08, 0.12), (0.02, 0.15), (0.16, 0.135), (0.32, 0.25), (0.45, 0.31), (0.56, 0.12)], "depth": 0.62, "sq": 2.5},
    "block": {"pts": [(-0.10, 0.21), (0.02, 0.25), (0.20, 0.26), (0.34, 0.28), (0.46, 0.28), (0.56, 0.15)], "depth": 0.72, "sq": 3.6},
    "pear": {"pts": [(-0.12, 0.19), (0.0, 0.27), (0.14, 0.27), (0.30, 0.215), (0.45, 0.175), (0.56, 0.09)], "depth": 0.86, "sq": 2.0},
    "slim": {"pts": [(-0.08, 0.115), (0.02, 0.15), (0.17, 0.11), (0.33, 0.15), (0.45, 0.17), (0.56, 0.08)], "depth": 0.7, "sq": 2.0},
    "blob": {"pts": [(-0.12, 0.17), (0.0, 0.27), (0.18, 0.30), (0.36, 0.285), (0.50, 0.22), (0.60, 0.12)], "depth": 0.9, "sq": 2.0},
}

# Cabeças (meia-profundidade, meia-altura, meia-largura). A cabeça padrão era uma esfera de 0,24.
HEADS = {
    "round": (0.24, 0.24, 0.245),
    "wide": (0.235, 0.225, 0.28),
    "tall": (0.22, 0.27, 0.215),
    "bean": (0.25, 0.27, 0.235),
    "small": (0.205, 0.215, 0.205),
    "flat": (0.235, 0.2, 0.265),
}
NECK_BODIES = {"standard", "wedge", "pear", "slim"}


def body_profile(look):
    return BODIES[look.get("body") or "standard"]


def half_width(look, y):
    """Meia-largura do tronco na altura y (unidades do tronco), por interpolação do perfil."""
    pts = body_profile(look)["pts"]
    if y <= pts[0][0]:
        return pts[0][1]
    for (y0, w0), (y1, w1) in zip(pts, pts[1:]):
        if y <= y1:
            u = (y - y0) / (y1 - y0)
            return w0 + (w1 - w0) * u
    return pts[-1][1]


def torso_rings(look, y_from, y_to, t, bk, grow=1.0):
    prof = body_profile(look)
    ys = sorted({y for y, _ in prof["pts"] if y_from < y < y_to} | {y_from, y_to})
    # Anéis extras entre os pontos para a curva ficar macia.
    dense = []
    for y0, y1 in zip(ys, ys[1:]):
        dense += [y0, (y0 + y1) / 2]
    dense.append(ys[-1])
    return [(y * t, half_width(look, y) * bk * prof["depth"] * grow, half_width(look, y) * bk * grow) for y in dense]


def chest_front(look, t, bk, y=0.34):
    """Distância do centro até a frente do peito (para emblema, listra e armadura)."""
    return half_width(look, y) * bk * body_profile(look)["depth"]


# ---------------------------------------------------------------------------
# Lutador
# ---------------------------------------------------------------------------


def build_fighter(look):
    ext = set(look["extras"])
    p = look.get("proportions") or {}
    bk = look["bulk"]
    t = p.get("torso", 1.0)
    a = p.get("arms", 1.0)
    legs = p.get("legs", 1.0)
    thigh = THIGH * legs
    shin_len = SHIN * legs
    hip_height = thigh + shin_len + 0.06
    shape = look.get("body") or "standard"
    top, bottom = look["top"], look["bottom"]

    root = empty("fighter", None, (0, 0, 0))
    hips = empty("hips", root, (0, hip_height, 0))
    spine = empty("spine", hips, (0, 0.02, 0))

    # Tronco torneado pelo perfil da forma: calça embaixo, camisa por cima com barra.
    prof = body_profile(look)
    sq, depth = prof["sq"], prof["depth"]
    bottom_y = prof["pts"][0][0]
    top_y = prof["pts"][-1][0]
    if shape == "blob":
        rings = torso_rings(look, bottom_y, top_y, t, bk)
        y0, rx0, rz0 = rings[0]
        y1, rx1, rz1 = rings[-1]
        rings = dome(y0, rx0, rz0, 0.08, -1) + rings + dome(y1, rx1, rz1, 0.06, 1)
        loft("body", rings, spine, (0, 0, 0), top, sq=sq, pole_bottom=y0 - 0.08, pole_top=y1 + 0.06, segs=22, subdiv=1)
    else:
        waist = 0.12
        pants = torso_rings(look, bottom_y, waist + 0.04, t, bk)
        y0, rx0, rz0 = pants[0]
        pants = dome(y0, rx0, rz0, 0.07, -1) + pants
        loft("pelvis", pants, spine, (0, 0, 0), bottom, sq=sq, pole_bottom=y0 - 0.07, cap_top=True, segs=20, subdiv=1)
        shirt = torso_rings(look, waist, top_y, t, bk, grow=1.04)
        y1, rx1, rz1 = shirt[-1]
        shirt = shirt + dome(y1, rx1, rz1, 0.05, 1, n=3)
        loft("torso", shirt, spine, (0, 0, 0), top, sq=sq, pole_top=y1 + 0.05, segs=20, subdiv=1)
        build_shirt_details(look, spine, t, bk, waist, top_y, shape)

    front = chest_front(look, t, bk)
    empty("emblem", spine, (front + 0.012, 0.34 * t, 0))
    if "stripe" in ext:
        box("stripe", 0.05, 0.34 * t, 0.42 * bk * depth / 0.74, spine, (front - 0.01, 0.3 * t, 0), 0xF4F4F4, bevel=0.01)
    if "armor" in ext:
        build_breastplate(look, spine, t, bk)
    if "belt" in ext:
        # Cinto chapado logo abaixo da barra (o anel de antes virava uma faixa preta grossa).
        pelvis = torso_at(look, t, bk, 1.0)
        u0, u1 = 0.07, 0.115
        patch("belt", pelvis, u0, u1, 0, math.tau, look["accent"], spine, 0.012, nu=1, na=28, wrap=True)
        ring_line("beltLow", pelvis, u0, spine, 0.014, width=0.009)
        buckle = pelvis((u0 + u1) / 2, 0.0, 0.02)[0]
        box("buckle", 0.03, 0.07, 0.1, spine, buckle, 0xE8C547, bevel=0.01)
    if "cape" in ext:
        pivot = empty("dangle:cape", spine, (-front - 0.02, 0.5 * t, 0))
        pivot.rotation_euler = b_rot(rz=-0.12)
        box("cape", 0.04, 0.95, half_width(look, 0.45) * bk * 2.1, pivot, (0, -0.47, 0), look["hair"], bevel=0.015)
    if "rocks" in ext:
        for i, (x, y, z) in enumerate([(-0.12, 0.45, 0.15), (-0.15, 0.3, -0.12), (0.05, 0.52, -0.2)]):
            sphere(f"rock{i}", 0.1, spine, (x * bk, y * t, z * bk), 0x6B5B4B, segs=6, rings=4)
    shoulder_z = half_width(look, 0.45) * bk + 0.03
    if "shoulderPads" in ext:
        for i, z in enumerate((shoulder_z, -shoulder_z)):
            sphere(f"pad{i}", 0.14 * bk, spine, (0, 0.47 * t, z), top, scale=(1, 0.75, 1))
    if "scarf" in ext:
        # Cachecol: tubo gordinho justo no pescoço (o anel de antes deixava um buraco preto em volta).
        y = 0.55 * t
        r0, r1 = 0.074, 0.115
        loft("scarf", [(y - 0.06, r0, r0), (y - 0.035, r1, r1), (y + 0.025, r1, r1), (y + 0.05, r0, r0)], spine, (0, 0, 0), look["accent"], segs=18, subdiv=1)
        tail = empty("dangle:scarf", spine, (-0.12, 0.5 * t, 0.08))
        tail.rotation_euler = b_rot(rz=-0.4)
        box("scarfTail", 0.06, 0.3, 0.1, tail, (0, -0.15, 0), look["accent"], bevel=0.015)
    if "boombox" in ext:
        box("boombox", 0.2, 0.32, 0.5, spine, (-front - 0.12, 0.32 * t, 0), 0x2A2A33, bevel=0.025)
        for i, z in enumerate((0.13, -0.13)):
            cone(f"speaker{i}", 0.09, 0.09, 0.03, spine, (-front - 0.23, 0.32 * t, z), look["glow"], glow=True, rot=(0, 0, math.pi / 2), segs=16)

    build_head(look, spine, t, ext)
    build_arms(look, spine, t, a, bk, ext, shoulder_z)
    build_legs(look, hips, thigh, shin_len, bk)
    build_props(look, spine)
    return root


def outfit_of(look):
    return look.get("outfit") or {}


def trim_color(look):
    """Cor de gola, barra e punho: a pedida no look ou a da blusa um pouco mais escura."""
    return outfit_of(look).get("trim") or darker(look["top"], 0.78)


# Afastamento dos detalhes: a malha do tronco é suavizada (subdivisão) e encolhe um pouco.
SHIRT_OFF = 0.012


def build_shirt_details(look, spine, t, bk, waist, top_y, shape):
    o = outfit_of(look)
    shirt = torso_at(look, t, bk, 1.04)
    pelvis = torso_at(look, t, bk, 1.0)
    trim = trim_color(look)
    off = SHIRT_OFF

    # Barra: faixa na cor de acabamento e o traço onde a blusa termina (separa blusa e calça).
    if o.get("ragged"):
        zigzag("hemRag", shirt, waist, 0.06, 0, math.tau, 16, look["top"], spine, off)
    else:
        patch("hem", shirt, waist, waist + 0.035, 0, math.tau, trim, spine, off, nu=1, na=28, wrap=True)
        ring_line("hemLine", shirt, waist, spine, off + 0.002)
        ring_line("hemTop", shirt, waist + 0.035, spine, off + 0.002, width=0.008)

    # Gola: faixa em volta da base do pescoço, com traço na borda de cima.
    if shape in NECK_BODIES:
        hw = half_width(look, top_y) * bk * 1.04
        depth = body_profile(look)["depth"]
        y0 = top_y * t - 0.005
        y1 = top_y * t + 0.035
        neck = 0.082

        def collar_at(u, a, off_):
            k = (u - y0) / (y1 - y0)
            rx = hw * depth * (1 - k) + neck * k + off_
            rz = hw * (1 - k) + neck * k + off_
            n = (math.cos(a), 0.0, math.sin(a))
            return (n[0] * rx, u, n[2] * rz), n

        patch("collar", collar_at, y0, y1, 0, math.tau, trim, spine, 0.004, nu=2, na=24, wrap=True)
        ring_line("collarLine", collar_at, y1, spine, 0.006, width=0.011)

    # Jaqueta aberta: faixa da camiseta de dentro, com as bordas da jaqueta em nanquim.
    chest_top = top_y - 0.08
    if o.get("openFront"):
        edge = 0.34
        patch("openFront", shirt, waist + 0.035, chest_top, -edge, edge, o["openFront"], spine, off, nu=6, na=6)
        for i, a in enumerate((edge, -edge)):
            ink(f"jacketEdge{i}", [shirt(waist + 0.035 + (chest_top - waist - 0.035) * k / 8, a, off + 0.003) for k in range(9)], spine, 0.014)
    if o.get("zipper") and not o.get("openFront"):
        a = 0.0
        ink("zipper", [shirt(waist + 0.035 + (chest_top - waist - 0.035) * k / 8, a, off + 0.004) for k in range(9)], spine, 0.012)
        pull = shirt(chest_top - 0.03, a, off + 0.006)[0]
        box(FLAT + "zipPull", 0.012, 0.045, 0.025, spine, pull, trim, bevel=0.004)
    buttons = o.get("buttons")
    if buttons:
        n = buttons["count"]
        for i in range(n):
            u = chest_top - 0.03 - (chest_top - waist - 0.1) * i / max(1, n - 1)
            pt = shirt(u, 0.0, off)[0]
            sphere(FLAT + f"button{i}", 0.024, spine, pt, buttons["color"], scale=(0.5, 1, 1), segs=10, rings=6)
    if o.get("chestPocket"):
        u0, u1, a0, a1 = 0.27, 0.38, 0.45, 0.9
        patch("chestPocket", shirt, u0, u1, a0, a1, darker(look["top"], 0.86), spine, off, nu=2, na=4)
        border("chestPocketInk", shirt, u0, u1, a0, a1, spine, off + 0.002)
    if o.get("pantsPockets"):
        for i, sgn in enumerate((1, -1)):
            pts = []
            for k in range(9):
                f = k / 8
                # Curva de bolso de calça: desce da cintura para o lado.
                pts.append(pelvis(waist - 0.01 - 0.1 * f * f, sgn * (0.45 + 0.75 * f), 0.01))
            ink(f"pocket{i}", pts, spine, 0.011)


def build_breastplate(look, spine, t, bk):
    """Peitoral curvo que acompanha o tronco (antes era uma caixa reta flutuando na frente)."""
    shell = torso_at(look, t, bk, 1.04)
    u0, u1, a0, a1 = 0.17, 0.5, -1.15, 1.15
    nu, na = 6, 12
    bm = bmesh.new()
    outer, inner = [], []
    for i in range(nu + 1):
        u = u0 + (u1 - u0) * i / nu
        # Mais grosso no meio, afinando nas bordas (forma de armadura de desenho).
        orow, irow = [], []
        for j in range(na + 1):
            a = a0 + (a1 - a0) * j / na
            edge = min(1.0, min(j, na - j) / 2.5, min(i, nu - i) / 1.5)
            orow.append(bm.verts.new(b(*shell(u, a, 0.012 + 0.045 * edge)[0])))
            irow.append(bm.verts.new(b(*shell(u, a, 0.0)[0])))
        outer.append(orow)
        inner.append(irow)
    for i in range(nu):
        for j in range(na):
            bm.faces.new((outer[i][j], outer[i + 1][j], outer[i + 1][j + 1], outer[i][j + 1]))
            bm.faces.new((inner[i][j], inner[i][j + 1], inner[i + 1][j + 1], inner[i + 1][j]))
    # Bordas fechando a casca.
    for i in range(nu):
        for j in (0, na):
            q = (outer[i][j], inner[i][j], inner[i + 1][j], outer[i + 1][j])
            bm.faces.new(q if j == 0 else tuple(reversed(q)))
    for j in range(na):
        for i in (0, nu):
            q = (outer[i][j], outer[i][j + 1], inner[i][j + 1], inner[i][j])
            bm.faces.new(q if i == 0 else tuple(reversed(q)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    _object("armor", bm, spine, (0, 0, 0), look["accent"], subdiv=1)
    # Divisão central e rebites, para ler como armadura e não como caixa.
    ink("armorSeam", [shell(u0 + 0.03 + (u1 - u0 - 0.06) * k / 6, 0.0, 0.06) for k in range(7)], spine, 0.012)
    for k, (u, a) in enumerate(((0.44, 0.6), (0.44, -0.6), (0.24, 0.6), (0.24, -0.6))):
        sphere(f"{FLAT}rivet{k}", 0.018, spine, shell(u, a, 0.052)[0], darker(look["accent"], 0.7), segs=8, rings=6)


def build_head(look, spine, t, ext):
    shape = look.get("body") or "standard"
    neck = shape in NECK_BODIES
    top_y = body_profile(look)["pts"][-1][0]
    # Sem pescoço (bloco e gota), a cabeça afunda no tronco.
    head = empty("head", spine, (0, (0.55 if neck else top_y - 0.04) * t, 0))
    s = (look.get("proportions") or {}).get("head", 1.0)
    head.scale = (s, s, s)
    skin = look["skin"]
    rx, ry, rz = HEADS[look.get("headShape") or "round"]
    cy = ry - (0.02 if neck else 0.06)
    center = (0.02, cy, 0)
    kx, ky, kz = rx / 0.24, ry / 0.24, rz / 0.24

    def hp(x, y, z):
        """Ponto pensado para a cabeça padrão (esfera 0,24 em (0.02, 0.22, 0)) -> esta cabeça."""
        return (0.02 + (x - 0.02) * kx, cy + (y - 0.22) * ky, z * kz)

    if neck:
        taper("neck", 0.07, 0.075, 0.06, head, (0, 0.0, 0), skin)
    sphere("skull", 1.0, head, center, skin, scale=(rx, ry, rz), segs=22, rings=16, subdiv=1)
    # Onde o jogo cola o rosto desenhado: centro e raios do crânio, um pouco para fora.
    empty("face", head, center, scale=(rx * 1.025, ry * 1.025, rz * 1.025))
    # Orelhas humanas: não para capuz nem para a gota (Gelatino é translúcido e mostraria por dentro).
    if not ({"ears", "roundEars", "headphones"} & ext) and look["hairStyle"] != "hood" and shape != "blob":
        for i, z in enumerate((rz - 0.01, -rz + 0.01)):
            # Sem contorno: com a casca, a orelha virava um oval escuro que parecia um olho.
            sphere(f"{FLAT}ear{i}", 0.055, head, (0.0, cy - 0.01, z), darker(skin, 0.86), scale=(0.55, 1, 0.45), segs=10, rings=8)

    if "visor" in ext:
        box("visor", 0.07, 0.08, 0.32 * kz, head, hp(0.235, 0.255, 0), look["accent"], glow=True, bevel=0.015)
    snout = "snout" in ext
    empty("mouth", head, hp(0.348, 0.085, 0) if snout else hp(0.248, 0.115, 0))

    build_hair(look, head, hp, (kx, ky, kz), ext)
    build_headwear(look, head, ext, hp, (kx, ky, kz))

    stars = empty("prop:stars", head, hp(0, 0.62, 0))
    for i in range(3):
        ang = i / 3 * math.tau
        sphere(f"star{i}", 0.07, stars, (math.cos(ang) * 0.3, 0, math.sin(ang) * 0.3), 0xFFE14D, glow=True, segs=4, rings=2)
    cone("prop:horn", 0.08, 0.0, 0.35, head, hp(0.3, 0.3, 0), 0xE8E0C8, rot=(0, 0, -1.2))


def build_hair(look, head, hp, k, ext):
    hair = look["hair"]
    style = look["hairStyle"]

    def cap(r, color):
        return hemisphere("hairCap", r, head, hp(-0.01, 0.25, 0), color, scale=k)

    if style == "spiky":
        cap(0.255, hair)
        for i, (x, y, z, rz, rx) in enumerate(
            [(0.12, 0.43, 0, -0.9, 0), (0, 0.47, 0.08, -0.3, 0.4), (0, 0.47, -0.08, -0.3, -0.4),
             (-0.14, 0.42, 0, 0.6, 0), (-0.1, 0.38, 0.15, 0.4, 0.8), (-0.1, 0.38, -0.15, 0.4, -0.8)]
        ):
            cone(f"spike{i}", 0.09, 0.0, 0.26, head, hp(x, y, z), hair, rot=(rx, 0, rz), segs=4, smooth=False)
    elif style == "messy":
        if "potHelmet" in ext:
            return  # a panela cobre o cabelo; a calota aparecia como uma faixa riscada embaixo dela
        cap(0.262, hair)
        if "cap" in ext:
            return  # chapéu por cima: só a franja do gorro aparece
        # Franja em mechas grossas e pontudas (forma gráfica, não fio a fio).
        for i, (x, y, z, r, rx) in enumerate(
            [(0.17, 0.4, 0.1, -1.3, 0.3), (0.19, 0.39, -0.03, -1.4, 0), (0.15, 0.4, -0.14, -1.2, -0.4),
             (-0.12, 0.43, 0.02, 0.7, 0), (0.0, 0.47, 0.12, -0.2, 0.6), (0.02, 0.48, -0.1, -0.3, -0.5)]
        ):
            cone(f"tuft{i}", 0.08, 0.0, 0.2, head, hp(x, y, z), hair, rot=(rx, 0, r), segs=4, smooth=False)
    elif style == "long":
        cap(0.262, hair)
        pivot = empty("dangle:hair", head, hp(-0.16, 0.33, 0))
        box("hairLong", 0.14, 0.75, 0.44 * k[2], pivot, (0, -0.35, 0), hair, bevel=0.05)
    elif style == "hood":
        hemisphere("hood", 0.31, head, hp(-0.02, 0.2, 0), look["top"], rot=(0, 0, 0.5), scale=(k[0], k[1] * 1.15, k[2]))
        cone("hoodTip", 0.12, 0.0, 0.25, head, hp(-0.25, 0.32, 0), look["top"], rot=(0, 0, 1.2))
    elif style == "crest":
        for i, (x, h) in enumerate([(0.08, 0.3), (-0.04, 0.38), (-0.15, 0.28)]):
            cone(f"crest{i}", 0.08, 0.0, h, head, hp(x, 0.42 + h / 3, 0), hair, glow=True, segs=4, smooth=False)


def build_headwear(look, head, ext, hp, k):
    skin = look["skin"]
    if "potHelmet" in ext:
        cone("pot", 0.25 * k[2], 0.27 * k[2], 0.24, head, hp(-0.01, 0.39, 0), 0xB8C0C8, segs=20)
        # Borda da panela: faixa mais escura com traço (o anel de antes deixava riscos).
        r = 0.255 * k[2] + 0.004
        rim_y = hp(-0.01, 0.3, 0)

        def rim_at(y, a, off, r=r, cx=rim_y[0]):
            n = (math.cos(a), 0.0, math.sin(a))
            return (cx + n[0] * (r + off), y, n[2] * (r + off)), n

        patch("potRim", rim_at, rim_y[1] - 0.005, rim_y[1] + 0.03, 0, math.tau, 0x9AA2AA, head, 0.0, nu=1, na=24, wrap=True)
        ring_line("potRimLine", rim_at, rim_y[1] + 0.03, head, 0.002, width=0.01)
        box("potHandle", 0.3, 0.05, 0.07, head, hp(-0.3, 0.42, 0), 0x3A3A3A, rot=(0, 0, 0.15), bevel=0.015)
    if "cap" in ext:
        # Boné alto o bastante para não esconder os olhos desenhados.
        hemisphere("capDome", 0.255, head, hp(-0.01, 0.31, 0), look["accent"], scale=k)
        box("capBrim", 0.22, 0.035, 0.32 * k[2], head, hp(0.23, 0.36, 0), look["accent"], rot=(0, 0, 0.12), bevel=0.012)
    if "snout" in ext:
        box("snout", 0.22, 0.18, 0.26 * k[2], head, hp(0.24, 0.13, 0), skin, bevel=0.06)
        box("noseTip", 0.05, 0.06, 0.18 * k[2], head, hp(0.35, 0.17, 0), 0x2A1A10, bevel=0.02)
    if "roundEars" in ext:
        for i, side in enumerate((1, -1)):
            sphere(f"roundEar{i}", 0.065, head, hp(-0.04, 0.42, side * 0.18), skin, segs=10, rings=8)
    if "ears" in ext:
        for side in (1, -1):
            pivot = empty("dangle:ear", head, hp(0, 0.3, side * 0.2))
            cone("ear", 0.08, 0.0, 0.26, pivot, (0, 0, side * 0.06), look["hair"], rot=(side * 1.2, 0, 0), segs=4, smooth=False)
    if "headphones" in ext:
        ring("phonesBand", 0.26, 0.03, head, hp(0, 0.22, 0), 0x222222, rot=(math.pi / 2, 0, 0), arc=math.pi, scale=(k[0], k[2], k[1]))
        for i, side in enumerate((1, -1)):
            cone(f"phone{i}", 0.09, 0.09, 0.08, head, hp(0, 0.22, side * 0.25), look["accent"], rot=(math.pi / 2, 0, 0), segs=16)
    if "gem" in ext:
        sphere("gem", 0.04, head, hp(0.25, 0.32, 0), look["accent"], glow=True, segs=4, rings=2)


def build_arms(look, spine, t, a, bk, ext, shoulder_z):
    gauntlet = "gauntlets" in ext
    glow_hands = "glowHands" in ext
    skin_color = look["accent"] if gauntlet else look["skin"]
    o = outfit_of(look)
    sleeves = o.get("sleeves") or "short"
    if look.get("body") == "blob":
        sleeves = "none"
    top = look["top"]
    trim = trim_color(look)
    for side, sign in (("A", 1), ("B", -1)):
        arm = empty(f"arm{side}", spine, (0, 0.45 * t, sign * shoulder_z))
        # Braço de "macarrão": grosso no ombro, fino no punho (nada de músculo desenhado).
        r_top, r_bot = 0.072 * bk, 0.056 * bk
        up_cy, up_half = -0.14 * a, 0.09 * a
        upper = limb_at(up_cy, up_half, r_top, r_bot)
        taper("upperArm", r_top, r_bot, 0.18 * a, arm, (0, up_cy, 0), top if sleeves == "long" else look["skin"])
        if sleeves == "short":
            # Manga de camiseta: tubo um pouco mais largo que o braço, aberto embaixo, com barra.
            y_bot, y_top = -0.165 * a, -0.04 * a
            flare = 0.02
            rb = upper(y_bot, 0)[0][0] + flare
            rt = r_top + 0.016
            rings = [(y_bot, rb, rb), (y_top, rt, rt)] + dome(y_top, rt, rt, rt, 1)
            loft("sleeve", rings, arm, (0, 0, 0), top, segs=16, pole_top=y_top + rt, cap_bottom=True)

            def sleeve_at(y, ang, off_, rb=rb, rt=rt, y_bot=y_bot, y_top=y_top):
                k = (y - y_bot) / (y_top - y_bot)
                r = rb + (rt - rb) * k + off_
                n = (math.cos(ang), 0.0, math.sin(ang))
                return (n[0] * r, y, n[2] * r), n

            if o.get("ragged"):
                zigzag("sleeveRag", sleeve_at, y_bot, 0.04, 0, math.tau, 8, top, arm, 0.004)
            else:
                patch("sleeveTrim", sleeve_at, y_bot, y_bot + 0.03, 0, math.tau, trim, arm, 0.004, nu=1, na=20, wrap=True)
                ring_line("sleeveLine", sleeve_at, y_bot, arm, 0.006, width=0.011, segs=20)
            if o.get("stripes"):
                ink("sleeveStripe", [sleeve_at(y_bot + 0.03 + (y_top - y_bot - 0.03) * k / 5, sign * math.pi / 2, 0.005) for k in range(6)], arm, 0.026, o["stripes"])
        elif o.get("stripes") and sleeves == "long":
            ink("armStripe", [upper(-0.05 * a - 0.17 * a * k / 6, sign * math.pi / 2, 0.006) for k in range(7)], arm, 0.026, o["stripes"])
        fore = empty(f"fore{side}", arm, (0, -0.3 * a, 0))
        if gauntlet:
            taper("forearm", 0.1, 0.07, 0.16 * a, fore, (0, -0.13 * a, 0), skin_color)
        else:
            fr_top, fr_bot = 0.052 * bk, 0.044 * bk
            fore_cy, fore_half = -0.13 * a, 0.08 * a
            taper("forearm", fr_top, fr_bot, 0.16 * a, fore, (0, fore_cy, 0), top if sleeves == "long" else skin_color)
            if sleeves == "long":
                lower = limb_at(fore_cy, fore_half, fr_top, fr_bot)
                y_w = fore_cy - fore_half - 0.01
                # Punho da manga comprida: faixa de acabamento, um pouco mais larga que o braço.
                patch("wristTrim", lower, y_w, y_w + 0.045, 0, math.tau, trim, fore, 0.008, nu=1, na=20, wrap=True)
                ring_line("wristLine", lower, y_w + 0.045, fore, 0.01, width=0.01, segs=20)
                if o.get("stripes"):
                    ink("foreStripe", [lower(fore_cy + fore_half - (2 * fore_half - 0.04) * k / 5, sign * math.pi / 2, 0.006) for k in range(6)], fore, 0.024, o["stripes"])
        hand = empty("hand", fore, (0, -0.31 * a, 0))
        # Luva de desenho: mão grande, punho fechado com 3 dedos e polegar.
        size = 0.13 if gauntlet else 0.108 * bk
        hand_color = look["glow"] if glow_hands else skin_color
        sphere("palm", size, hand, (0, 0, 0), hand_color, glow=glow_hands, scale=(1.0, 0.95, 1.1))
        for i, z in enumerate((-0.42, 0.0, 0.42)):
            sphere(f"finger{i}", size * 0.36, hand, (size * 0.62, -size * 0.3, z * size), hand_color, glow=glow_hands, segs=10, rings=8)
        sphere("thumb", size * 0.4, hand, (size * 0.5, size * 0.38, sign * size * 0.78), hand_color, glow=glow_hands, segs=10, rings=8)
        if side == "A" and "watch" in ext:
            cone("watch", 0.08, 0.08, 0.07, fore, (0, -0.2 * a, 0), look["accent"], glow=True, segs=16)
            box("watchFace", 0.05, 0.06, 0.09, fore, (0.075, -0.2 * a, 0), 0x1B1B1B, bevel=0.01)
        if side == "B" and "cannonArm" in ext:
            cone("cannon", 0.13, 0.11, 0.3, fore, (0, -0.25 * a, 0), 0x8A96A3, segs=16)
            cone("cannonMuzzle", 0.065, 0.065, 0.02, fore, (0, -0.41 * a, 0), look["glow"], glow=True, segs=16)


def build_legs(look, hips, thigh, shin_len, bk):
    shape = look.get("body") or "standard"
    o = outfit_of(look)
    gap = {"pear": 0.14, "block": 0.13, "blob": 0.13}.get(shape, 0.105) * bk
    for side, sign in (("A", 1), ("B", -1)):
        leg = empty(f"leg{side}", hips, (0, -0.02, sign * gap))
        th_top, th_bot = 0.095 * bk, 0.078 * bk
        th_cy, th_half = -thigh / 2, (thigh - 0.17) / 2
        taper("thigh", th_top, th_bot, thigh - 0.17, leg, (0, th_cy, 0), look["bottom"])
        thigh_at = limb_at(th_cy, th_half, th_top, th_bot)
        shin = empty(f"shin{side}", leg, (0, -thigh, 0))
        ca_top, ca_bot = 0.074 * bk, 0.062 * bk
        ca_cy, ca_half = -shin_len / 2 + 0.02, (shin_len - 0.15) / 2
        taper("calf", ca_top, ca_bot, shin_len - 0.15, shin, (0, ca_cy, 0), look["bottom"])
        calf_at = limb_at(ca_cy, ca_half, ca_top, ca_bot)
        if o.get("rolledCuffs"):
            # Barra dobrada: anel largo (entra na silhueta) com traço na dobra.
            y0, y1 = -shin_len + 0.06, -shin_len + 0.125
            r = ca_bot + 0.022
            loft("rolledCuff", [(y0, r, r), (y1, r, r)], shin, (0, 0, 0), o["rolledCuffs"], segs=18, cap_bottom=True, cap_top=True)

            def cuff_at(y, ang, off_, r=r):
                n = (math.cos(ang), 0.0, math.sin(ang))
                return (n[0] * (r + off_), y, n[2] * (r + off_)), n

            ring_line("cuffFold", cuff_at, (y0 + y1) / 2, shin, 0.004, width=0.009, segs=20)
        if o.get("kneePatch"):
            y0, y1 = th_cy - th_half + 0.01, th_cy - th_half + 0.1
            patch("kneePatch", thigh_at, y0, y1, -0.75, 0.75, o["kneePatch"], leg, 0.006, nu=2, na=6)
            border("kneePatchInk", thigh_at, y0, y1, -0.75, 0.75, leg, 0.008, width=0.01, steps=4)
        if o.get("stripes"):
            ang = sign * math.pi / 2
            ink("legStripe", [thigh_at(th_cy + th_half - 2 * th_half * k / 6, ang, 0.006) for k in range(7)], leg, 0.028, o["stripes"])
            ink("shinStripe", [calf_at(ca_cy + ca_half - (2 * ca_half - 0.05) * k / 6, ang, 0.006) for k in range(7)], shin, 0.026, o["stripes"])
        # Tênis de desenho: grande e redondo, bico levantado (em outra cor), sola clara e cadarço.
        box("shoe", 0.28, 0.12, 0.17 * bk, shin, (0.06, -shin_len - 0.005, 0), look["shoes"], bevel=0.045)
        sphere("toe", 0.095 * bk, shin, (0.19, -shin_len - 0.015, 0), o.get("shoeTrim") or look["shoes"], scale=(1.05, 0.72, 0.95))
        box("sole", 0.36, 0.035, 0.18 * bk, shin, (0.08, -shin_len - 0.07, 0), 0xF2F2F2, bevel=0.012)
        box("laces", 0.09, 0.015, 0.09 * bk, shin, (0.09, -shin_len + 0.055, 0), 0xF2F2F2, bevel=0.005)
        cone("prop:jets", 0.08, 0.0, 0.3, shin, (0, -shin_len - 0.2, 0), 0xFF9A2E, glow=True, rot=(0, 0, math.pi), segs=10)


def build_props(look, spine):
    """Armas e acessórios que só aparecem durante certos golpes (mesmas posições do jogo)."""
    fore_a = bpy.data.objects["foreA"]
    fore_b = bpy.data.objects["foreB"]
    a = (look.get("proportions") or {}).get("arms", 1.0)

    bread = empty("prop:bread", fore_a, (0, -0.35 * a, 0))
    capsule("baguette", 0.08, 0.95, bread, (0, -0.55, 0), 0xD9A25A, glow=True)
    for i in range(4):
        box(f"cut{i}", 0.1, 0.02, 0.17, bread, (0.05, -0.25 - i * 0.2, 0), 0xA86A2A, rot=(0.5, 0, 0))

    rake = empty("prop:rake", fore_a, (0, -0.3 * a, 0))
    cone("rakeHandle", 0.03, 0.03, 1.2, rake, (0, -0.6, 0), 0x8A5A2A, segs=8)
    box("rakeHead", 0.1, 0.06, 0.5, rake, (0, -1.2, 0), 0x7A7F88, bevel=0.01)
    for i in range(-2, 3):
        box(f"tine{i + 2}", 0.16, 0.025, 0.025, rake, (0.08, -1.2, i * 0.11), 0x7A7F88)

    lid_prop = cone("prop:lid", 0.32, 0.32, 0.05, fore_b, (0.1, -0.2 * a, 0), 0xB8C0C8, rot=(0, 0, math.pi / 2), segs=24)
    sphere("lidKnob", 0.05, lid_prop, (0, 0.04, 0), 0x3A3A3A, segs=8, rings=6)

    sword = empty("prop:sword", fore_a, (0, -0.35 * a, 0))
    box("blade", 0.05, 1.1, 0.12, sword, (0, -0.55, 0), look["accent"], glow=True, bevel=0.01)

    hammer = empty("prop:hammer", fore_a, (0, -0.3 * a, 0))
    cone("hammerHandle", 0.04, 0.04, 0.6, hammer, (0, -0.3, 0), 0x555566, segs=8)
    box("hammerHead", 0.45, 0.3, 0.3, hammer, (0, -0.65, 0), look["accent"], glow=True, bevel=0.04)

    shadow = empty("prop:shadowHand", fore_a, (0, -0.3 * a, 0))
    cone("shadowArm", 0.06, 0.1, 1.9, shadow, (0, -0.95, 0), 0x2A0A45, glow=True, segs=8)
    sphere("shadowFist", 0.22, shadow, (0, -1.95, 0), 0x7A2BD1, glow=True)

    cone("prop:rocket", 0.1, 0.0, 0.35, fore_a, (0, -0.1 * a, 0), 0xFF9A2E, glow=True, segs=10)

    wings = empty("prop:wings", spine, (-0.1, 0.4, 0))
    for i, side in enumerate((1, -1)):
        box(f"wing{i}", 0.4, 0.05, 0.9, wings, (-0.1, 0, side * 0.5), look["hair"], rot=(side * 0.3, 0, 0), bevel=0.02)


# ---------------------------------------------------------------------------


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(argv) < 2:
        raise SystemExit("uso: -- looks.json pasta_saida [ids...]")
    looks_path, out_dir, *only = argv
    with open(looks_path, encoding="utf-8") as f:
        looks = json.load(f)
    os.makedirs(out_dir, exist_ok=True)
    manifest_path = os.path.join(out_dir, "manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding="utf-8-sig") as f:
            manifest = json.load(f)
    for fid, forms in looks.items():
        if only and fid not in only:
            continue
        files = []
        for form, look in enumerate(forms):
            bpy.ops.wm.read_factory_settings(use_empty=True)
            _materials.clear()
            build_fighter(look)
            name = f"{fid}.glb" if form == 0 else f"{fid}-forma{form}.glb"
            export(os.path.join(out_dir, name))
            files.append(name)
            print(f"OK {name}")
        manifest[fid] = files
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"manifest com {len(manifest)} lutadores")


main()
