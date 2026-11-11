import { describe, expect, it } from 'vitest';
import { cleanGpuName, isSoftwareRenderer } from './scene';

describe('isSoftwareRenderer', () => {
  it('reconhece quando o navegador desenha sem a placa de vídeo', () => {
    expect(isSoftwareRenderer('Microsoft Basic Render Driver')).toBe(true);
    expect(isSoftwareRenderer('Google SwiftShader')).toBe(true);
    expect(isSoftwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
  });

  it('não confunde placas de verdade', () => {
    expect(isSoftwareRenderer('NVIDIA GeForce RTX 3050')).toBe(false);
    expect(isSoftwareRenderer('Intel(R) UHD Graphics 620')).toBe(false);
    expect(isSoftwareRenderer('Apple M2')).toBe(false);
  });
});

describe('cleanGpuName', () => {
  it('tira os detalhes do ANGLE e deixa só o nome da placa', () => {
    expect(
      cleanGpuName(
        'ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 (0x00002507) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      ),
    ).toBe('NVIDIA GeForce RTX 3050');
    expect(
      cleanGpuName('ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)'),
    ).toBe('Intel(R) UHD Graphics 620');
  });

  it('mantém nomes que não vêm do ANGLE', () => {
    expect(cleanGpuName('Apple M2')).toBe('Apple M2');
    expect(cleanGpuName('')).toBe('placa desconhecida');
  });
});
