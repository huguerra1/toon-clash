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


def ring(name, radius, thickness, parent, pos, color, glow=False, rot=(0, 0, 0), arc=math.tau):
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
    return _object(name, bm, parent, pos, color, glow, rot=rot)


def empty(name, parent, pos):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = b(*pos)
    return obj


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

    root = empty("fighter", None, (0, 0, 0))
    hips = empty("hips", root, (0, hip_height, 0))
    spine = empty("spine", hips, (0, 0.02, 0))

    # Tronco: quadril, peito com cintura, barra da camisa e gola.
    sphere("pelvis", 0.19 * bk, spine, (0, 0.02, 0), look["bottom"], subdiv=1, segs=12, rings=8)
    capsule("torso", 0.2 * bk, 0.22 * t, spine, (0, 0.3 * t, 0), look["top"], scale=(0.85, 1, 1.05))
    ring("hem", 0.19 * bk, 0.035, spine, (0, 0.13, 0), look["top"])
    ring("collar", 0.1, 0.035, spine, (0, 0.52 * t, 0), look["top"])
    if "stripe" in ext:
        box("stripe", 0.06, 0.34 * t, 0.42 * bk, spine, (0.15 * bk, 0.3 * t, 0), 0xF4F4F4, bevel=0.01)
    if "armor" in ext:
        box("armor", 0.16, 0.36 * t, 0.44 * bk, spine, (0.12 * bk, 0.32 * t, 0), look["accent"], bevel=0.03)
    if "belt" in ext:
        ring("belt", 0.185 * bk, 0.035, spine, (0, 0.1, 0), look["accent"])
        box("buckle", 0.04, 0.07, 0.1, spine, (0.19 * bk, 0.1, 0), 0xE8C547, bevel=0.01)
    if "cape" in ext:
        pivot = empty("dangle:cape", spine, (-0.18 * bk, 0.5 * t, 0))
        pivot.rotation_euler = b_rot(rz=-0.12)
        box("cape", 0.04, 0.95, 0.5 * bk, pivot, (0, -0.47, 0), look["hair"], bevel=0.015)
    if "rocks" in ext:
        for i, (x, y, z) in enumerate([(-0.12, 0.45, 0.15), (-0.15, 0.3, -0.12), (0.05, 0.52, -0.2)]):
            sphere(f"rock{i}", 0.1, spine, (x * bk, y * t, z * bk), 0x6B5B4B, segs=6, rings=4)
    if "shoulderPads" in ext:
        sz = 0.25 * bk + 0.05
        for i, z in enumerate((sz, -sz)):
            sphere(f"pad{i}", 0.14 * bk, spine, (0, 0.47 * t, z), look["top"], scale=(1, 0.8, 1))
    if "scarf" in ext:
        ring("scarf", 0.13, 0.05, spine, (0, 0.52 * t, 0), look["accent"])
        tail = empty("dangle:scarf", spine, (-0.12, 0.5 * t, 0.08))
        tail.rotation_euler = b_rot(rz=-0.4)
        box("scarfTail", 0.06, 0.3, 0.1, tail, (0, -0.15, 0), look["accent"], bevel=0.015)
    if "boombox" in ext:
        box("boombox", 0.2, 0.32, 0.5, spine, (-0.3, 0.32 * t, 0), 0x2A2A33, bevel=0.025)
        for i, z in enumerate((0.13, -0.13)):
            cone(f"speaker{i}", 0.09, 0.09, 0.03, spine, (-0.41, 0.32 * t, z), look["glow"], glow=True, rot=(0, 0, math.pi / 2), segs=16)

    build_head(look, spine, t, ext)
    build_arms(look, spine, t, a, bk, ext)
    build_legs(look, hips, thigh, shin_len, bk)
    build_props(look, spine)
    return root


def build_head(look, spine, t, ext):
    head = empty("head", spine, (0, 0.55 * t, 0))
    s = (look.get("proportions") or {}).get("head", 1.0)
    head.scale = (s, s, s)
    skin = look["skin"]
    capsule("neck", 0.07, 0.06, head, (0, 0.0, 0), skin)
    sphere("skull", 0.24, head, (0.02, 0.22, 0), skin, segs=20, rings=14, subdiv=1)
    human = not ({"snout", "visor"} & ext)
    if human:
        sphere("nose", 0.035, head, (0.255, 0.19, 0), skin, segs=10, rings=8)
    if not ({"ears", "roundEars", "headphones"} & ext) and look["hairStyle"] != "hood":
        for i, z in enumerate((0.235, -0.235)):
            sphere(f"ear{i}", 0.05, head, (0.0, 0.21, z), skin, scale=(0.6, 1, 0.45), segs=10, rings=8)

    # Rosto: olhos com pálpebra e pupila, sobrancelhas e ponto da boca.
    glow_eyes = "glowEyes" in ext
    if "visor" in ext:
        box("visor", 0.06, 0.07, 0.3, head, (0.23, 0.25, 0), look["accent"], glow=True, bevel=0.01)
    else:
        for side in (1, -1):
            z = side * 0.085
            eye = empty("eye", head, (0.2, 0.25, z))
            radius = 0.058 if glow_eyes else 0.068
            sphere("eyeball", radius, eye, (0, 0, 0), look["glow"] if glow_eyes else 0xFFFFFF, glow=glow_eyes)
            if not glow_eyes:
                pupil = empty("pupil", eye, (0, 0, 0))
                sphere("iris", 0.034, pupil, (0.052, 0, 0), 0x111111, segs=10, rings=8)
                sphere("sparkle", 0.011, pupil, (0.08, 0.016, 0.01), 0xFFFFFF, segs=6, rings=4)
            lid = hemisphere("lid", radius * 1.12, eye, (0, 0, 0), skin)
            lid.rotation_euler = b_rot(rz=math.pi / 2)
            brow = box("brow", 0.028, 0.03, 0.12, head, (0.215, 0.36, z), darker(look["hair"]), rot=(0, 0, -0.35), bevel=0.008)
            del brow
    snout = "snout" in ext
    empty("mouth", head, (0.348 if snout else 0.248, 0.085 if snout else 0.115, 0))

    build_hair(look, head)
    build_headwear(look, head, ext)

    stars = empty("prop:stars", head, (0, 0.62, 0))
    for i in range(3):
        ang = i / 3 * math.tau
        sphere(f"star{i}", 0.07, stars, (math.cos(ang) * 0.3, 0, math.sin(ang) * 0.3), 0xFFE14D, glow=True, segs=4, rings=2)
    horn = cone("prop:horn", 0.08, 0.0, 0.35, head, (0.3, 0.3, 0), 0xE8E0C8, rot=(0, 0, -1.2))
    del horn


def build_hair(look, head):
    hair = look["hair"]
    style = look["hairStyle"]

    def cap(r, color):
        return hemisphere("hairCap", r, head, (-0.01, 0.25, 0), color)

    if style == "spiky":
        cap(0.255, hair)
        for i, (x, y, z, rz, rx) in enumerate(
            [(0.12, 0.43, 0, -0.9, 0), (0, 0.47, 0.08, -0.3, 0.4), (0, 0.47, -0.08, -0.3, -0.4),
             (-0.14, 0.42, 0, 0.6, 0), (-0.1, 0.38, 0.15, 0.4, 0.8), (-0.1, 0.38, -0.15, 0.4, -0.8)]
        ):
            cone(f"spike{i}", 0.08, 0.0, 0.22, head, (x, y, z), hair, rot=(rx, 0, rz), segs=8)
    elif style == "messy":
        cap(0.26, hair)
        for i, (x, z, r) in enumerate([(0.1, 0.1, -0.5), (0.12, -0.08, -0.7), (-0.15, 0, 0.6), (0.02, 0.16, -0.2)]):
            cone(f"tuft{i}", 0.07, 0.0, 0.18, head, (x, 0.42, z), hair, rot=(0, 0, r), segs=8)
    elif style == "long":
        cap(0.26, hair)
        pivot = empty("dangle:hair", head, (-0.16, 0.33, 0))
        box("hairLong", 0.14, 0.75, 0.44, pivot, (0, -0.35, 0), hair, bevel=0.05)
    elif style == "hood":
        hood = hemisphere("hood", 0.31, head, (-0.02, 0.2, 0), look["top"], rot=(0, 0, 0.5), scale=(1, 1.15, 1))
        del hood
        cone("hoodTip", 0.12, 0.0, 0.25, head, (-0.25, 0.32, 0), look["top"], rot=(0, 0, 1.2))
    elif style == "crest":
        for i, (x, h) in enumerate([(0.08, 0.3), (-0.04, 0.38), (-0.15, 0.28)]):
            cone(f"crest{i}", 0.08, 0.0, h, head, (x, 0.42 + h / 3, 0), hair, glow=True, segs=8)


def build_headwear(look, head, ext):
    skin = look["skin"]
    if "potHelmet" in ext:
        cone("pot", 0.25, 0.27, 0.22, head, (-0.01, 0.4, 0), 0xB8C0C8, segs=20)
        ring("potRim", 0.27, 0.02, head, (-0.01, 0.3, 0), 0x9AA2AA)
        box("potHandle", 0.3, 0.05, 0.07, head, (-0.3, 0.42, 0), 0x3A3A3A, rot=(0, 0, 0.15), bevel=0.015)
    if "cap" in ext:
        hemisphere("capDome", 0.255, head, (-0.01, 0.27, 0), look["accent"])
        box("capBrim", 0.2, 0.03, 0.3, head, (0.22, 0.29, 0), look["accent"], bevel=0.01)
    if "snout" in ext:
        box("snout", 0.2, 0.17, 0.24, head, (0.24, 0.13, 0), skin, bevel=0.05)
        box("noseTip", 0.04, 0.05, 0.16, head, (0.345, 0.17, 0), 0x2A1A10, bevel=0.015)
    if "roundEars" in ext:
        for i, side in enumerate((1, -1)):
            sphere(f"roundEar{i}", 0.06, head, (-0.04, 0.42, side * 0.18), skin, segs=10, rings=8)
    if "ears" in ext:
        for side in (1, -1):
            pivot = empty("dangle:ear", head, (0, 0.3, side * 0.2))
            cone("ear", 0.07, 0.0, 0.22, pivot, (0, 0, side * 0.06), look["hair"], rot=(side * 1.2, 0, 0), segs=8)
    if "headphones" in ext:
        ring("phonesBand", 0.26, 0.03, head, (0, 0.22, 0), 0x222222, rot=(math.pi / 2, 0, 0), arc=math.pi)
        for i, side in enumerate((1, -1)):
            cone(f"phone{i}", 0.09, 0.09, 0.08, head, (0, 0.22, side * 0.25), look["accent"], rot=(math.pi / 2, 0, 0), segs=16)
    if "gem" in ext:
        sphere("gem", 0.04, head, (0.25, 0.32, 0), look["accent"], glow=True, segs=4, rings=2)


def build_arms(look, spine, t, a, bk, ext):
    shoulder_z = 0.25 * bk + 0.05
    gauntlet = "gauntlets" in ext
    glow_hands = "glowHands" in ext
    skin_color = look["accent"] if gauntlet else look["skin"]
    for side, sign in (("A", 1), ("B", -1)):
        arm = empty(f"arm{side}", spine, (0, 0.45 * t, sign * shoulder_z))
        capsule("upperArm", 0.075 * bk, 0.18 * a, arm, (0, -0.14 * a, 0), look["top"])
        fore = empty(f"fore{side}", arm, (0, -0.3 * a, 0))
        ring("cuff", 0.075 * bk, 0.025, fore, (0, -0.02, 0), look["top"])
        capsule("forearm", 0.085 if gauntlet else 0.065 * bk, 0.16 * a, fore, (0, -0.13 * a, 0), skin_color)
        hand = empty("hand", fore, (0, -0.3 * a, 0))
        size = 0.11 if gauntlet else 0.085 * bk
        hand_color = look["glow"] if glow_hands else skin_color
        sphere("palm", size, hand, (0, 0, 0), hand_color, glow=glow_hands, scale=(1.05, 0.92, 1.15))
        sphere("thumb", size * 0.42, hand, (size * 0.55, size * 0.35, sign * size * 0.75), hand_color, glow=glow_hands, segs=10, rings=8)
        if side == "A" and "watch" in ext:
            cone("watch", 0.085, 0.085, 0.07, fore, (0, -0.2 * a, 0), look["accent"], glow=True, segs=16)
        if side == "B" and "cannonArm" in ext:
            cone("cannon", 0.12, 0.1, 0.3, fore, (0, -0.25 * a, 0), 0x8A96A3, segs=16)
            cone("cannonMuzzle", 0.06, 0.06, 0.02, fore, (0, -0.41 * a, 0), look["glow"], glow=True, segs=16)


def build_legs(look, hips, thigh, shin_len, bk):
    for side, sign in (("A", 1), ("B", -1)):
        leg = empty(f"leg{side}", hips, (0, -0.02, sign * 0.11 * bk))
        capsule("thigh", 0.09 * bk, thigh - 0.18, leg, (0, -thigh / 2, 0), look["bottom"])
        shin = empty(f"shin{side}", leg, (0, -thigh, 0))
        capsule("calf", 0.075 * bk, shin_len - 0.16, shin, (0, -shin_len / 2 + 0.02, 0), look["bottom"])
        ring("pantsCuff", 0.078 * bk, 0.022, shin, (0, -shin_len + 0.06, 0), look["bottom"])
        # Tênis: corpo arredondado, biqueira, sola clara e cadarço.
        box("shoe", 0.24, 0.1, 0.14 * bk, shin, (0.05, -shin_len - 0.01, 0), look["shoes"], bevel=0.03)
        sphere("toe", 0.075 * bk, shin, (0.16, -shin_len - 0.02, 0), look["shoes"], scale=(1, 0.75, 0.95))
        box("sole", 0.3, 0.03, 0.15 * bk, shin, (0.07, -shin_len - 0.065, 0), 0xF2F2F2, bevel=0.01)
        box("laces", 0.08, 0.015, 0.08 * bk, shin, (0.08, -shin_len + 0.045, 0), 0xF2F2F2, bevel=0.005)
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
