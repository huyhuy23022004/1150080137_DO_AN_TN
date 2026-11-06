import QRCode from 'qrcode';

export interface QrRenderOptions {
  width?: number;
  margin?: number;
}

export async function renderQrDataUrl(
  value: string,
  options: QrRenderOptions = {},
): Promise<string> {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: options.width ?? 320,
    margin: options.margin ?? 1,
  });
}

export async function renderQrPng(value: string, options: QrRenderOptions = {}): Promise<Buffer> {
  return QRCode.toBuffer(value, {
    errorCorrectionLevel: 'M',
    type: 'png',
    width: options.width ?? 320,
    margin: options.margin ?? 1,
  });
}
