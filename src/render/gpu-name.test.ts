import { describe, expect, it } from 'vitest';
import { cleanGpuName } from './scene';

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
