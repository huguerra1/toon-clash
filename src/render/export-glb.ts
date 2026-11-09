import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { LOOKS, getLook } from '../characters/looks';
import type { CharacterId } from '../combat/types';
import { FighterModel } from './fighter-model';

/**
 * Exporta os lutadores montados com primitivas como .glb, com as partes já nomeadas no padrão
 * que o jogo entende. É o ponto de partida para refazer cada um no Blender (docs/MODELOS-3D.md).
 * Ferramenta de desenvolvimento: baixa um arquivo por lutador/forma.
 */
export async function exportFighters(
  ids: CharacterId[] = Object.keys(LOOKS) as CharacterId[],
): Promise<string[]> {
  const exporter = new GLTFExporter();
  const files: string[] = [];
  for (const id of ids) {
    for (let form = 0; form < LOOKS[id].length; form++) {
      const model = new FighterModel(getLook(id, form));
      // Contornos são recriados pelo jogo; acessórios vão visíveis para o artista poder editá-los.
      model.root.traverse((o) => {
        if (o.userData.outline) o.visible = false;
        else if (o.name.startsWith('prop:')) o.visible = true;
      });
      model.root.updateMatrixWorld(true);
      const data = await exporter.parseAsync(model.root, { binary: true, onlyVisible: true });
      const name = form === 0 ? `${id}.glb` : `${id}-forma${form}.glb`;
      download(new Blob([data as ArrayBuffer], { type: 'model/gltf-binary' }), name);
      files.push(name);
      model.dispose();
    }
  }
  return files;
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
