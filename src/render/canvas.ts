/**
 * Opção para os canvas que viram textura (rostos, emblemas, cenários, efeitos).
 * Desenhados uma vez só, ficam melhor na memória comum (CPU): em alguns navegadores o canvas
 * acelerado pela placa de vídeo some com traços de vários segmentos, e a textura sairia vazia.
 */
export const CPU_CANVAS: CanvasRenderingContext2DSettings = { willReadFrequently: true };
