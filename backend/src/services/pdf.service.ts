import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
// Usar el build legacy de pdfjs para compatibilidad en Node.js
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

// Rutas de fuentes estándar y mapas de caracteres de pdfjs-dist
const standardFontDataUrl = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + path.sep;
const cMapUrl = path.join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'cmaps') + path.sep;

export interface ExtractedPageImage {
  pageNumber: number;
  imageIndex: number;
  buffer: Buffer;
  width: number;
  height: number;
}

export class PdfService {
  /**
   * RF-032, RF-033:
   * Extrae las imágenes de cada página del PDF en alta resolución y formato PNG.
   * Si una página contiene frente y reverso como imágenes separadas, extrae ambas.
   */
  async extractImagesFromPdf(
    pdfBuffer: Buffer,
    onProgress?: (progress: { currentPage: number; totalPages: number; extractedCount: number }) => void | Promise<void>
  ): Promise<ExtractedPageImage[]> {
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      standardFontDataUrl,
      cMapUrl,
      cMapPacked: true,
    }).promise;
    const extractedImages: ExtractedPageImage[] = [];

    // Notificar inmediatamente el número total de páginas descubierto en el PDF (< 200ms)
    if (onProgress) {
      await onProgress({ currentPage: 0, totalPages: doc.numPages, extractedCount: 0 });
    }

    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const ops = await page.getOperatorList();
      let imageIndex = 0;

      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
          const imgName = ops.argsArray[i][0];
          try {
            let img: any = null;

            if (page.objs.has(imgName)) {
              img = await new Promise<any>((resolve) => page.objs.get(imgName, resolve));
            } else if (page.commonObjs.has(imgName)) {
              img = await new Promise<any>((resolve) => page.commonObjs.get(imgName, resolve));
            } else {
              // Si no está resuelto inmediatamente, esperar con salvaguarda de timeout de 3 segundos
              img = await Promise.race([
                new Promise<any>((resolve) => page.objs.get(imgName, resolve)),
                new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_RESOLVING_IMG')), 3000)),
              ]).catch(() => null);
            }

            if (!img || !img.data || !img.width || !img.height) continue;
            // Omitir marcas de agua CamScanner, firmas diminutas, iconos o sellos que no son cédulas
            // Una cédula real o página escaneada tiene dimensiones sustanciales (> 320px de ancho y > 180px de alto)
            if (img.width < 320 || img.height < 180) continue;

            // Descartar tiras o banners (marcas de agua como CamScanner tienen aspecto extremo ej: 800x40 o 20:1)
            const aspectRatio = img.width / img.height;
            if (aspectRatio > 3.5 || aspectRatio < 0.28) continue;

            const channels = img.kind === 2 ? 3 : (img.kind === 1 ? 1 : 4);
            const isStacked = img.height > img.width * 1.15 && img.height >= 800;

            if (isStacked) {
              // Documento escaneado en formato vertical con Frente (mitad superior) y Reverso (mitad inferior) en una sola página.
              // Extraer ambas mitades individualmente para que cada cara mantenga 100% de nitidez y OCR/Barcode perfecto.
              const topHalfBuf = await sharp(Buffer.from(img.data), {
                raw: { width: img.width, height: img.height, channels },
              })
                .extract({ left: 0, top: 0, width: img.width, height: Math.floor(img.height * 0.52) })
                .resize({ width: 650, fit: 'inside', withoutEnlargement: true })
                .normalize()
                .png({ compressionLevel: 1 })
                .toBuffer();

              extractedImages.push({
                pageNumber: p,
                imageIndex,
                buffer: topHalfBuf,
                width: img.width,
                height: Math.floor(img.height * 0.52),
              });
              imageIndex++;

              const bottomHalfBuf = await sharp(Buffer.from(img.data), {
                raw: { width: img.width, height: img.height, channels },
              })
                .extract({ left: 0, top: Math.floor(img.height * 0.48), width: img.width, height: Math.floor(img.height * 0.52) })
                .resize({ width: 650, fit: 'inside', withoutEnlargement: true })
                .normalize()
                .png({ compressionLevel: 1 })
                .toBuffer();

              extractedImages.push({
                pageNumber: p,
                imageIndex,
                buffer: bottomHalfBuf,
                width: img.width,
                height: Math.floor(img.height * 0.52),
              });
              imageIndex++;
            } else {
              // Imagen individual estándar (cédula horizontal o cara aislada)
              let sharpImg = sharp(Buffer.from(img.data), {
                raw: { width: img.width, height: img.height, channels },
              });

              if (img.width > 950 || img.height > 950) {
                sharpImg = sharpImg.resize({
                  width: 950,
                  height: 950,
                  fit: 'inside',
                  withoutEnlargement: true,
                });
              }

              const pngBuffer = await sharpImg.normalize().png({ compressionLevel: 1 }).toBuffer();

              extractedImages.push({
                pageNumber: p,
                imageIndex,
                buffer: pngBuffer,
                width: img.width,
                height: img.height,
              });
              imageIndex++;
            }
          } catch (imgErr) {
            console.warn(`[PDF] Omitiendo imagen ${imgName} de página ${p}:`, imgErr);
          }
        }
      }

      // Notificar periódicamente el progreso de extracción de páginas
      if (onProgress && (p % 3 === 0 || p === doc.numPages)) {
        await onProgress({ currentPage: p, totalPages: doc.numPages, extractedCount: extractedImages.length });
      }
    }
    return extractedImages;
  }

  /**
   * Extrae las imágenes de cada página del PDF en streaming continuo.
   * Permite que el OCR comience a procesar de inmediato desde la página 1 sin esperar
   * a que termine la extracción de todas las páginas del documento.
   */
  async streamImagesFromPdf(
    pdfBuffer: Buffer,
    onTotalPages: (totalPages: number) => void | Promise<void>,
    onPageImages: (images: ExtractedPageImage[], pageNumber: number, totalPages: number) => Promise<void>
  ): Promise<number> {
    const doc = await pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      standardFontDataUrl,
      cMapUrl,
      cMapPacked: true,
    }).promise;

    const totalPages = doc.numPages;
    if (onTotalPages) {
      await onTotalPages(totalPages);
    }

    for (let p = 1; p <= totalPages; p++) {
      const page = await doc.getPage(p);
      const ops = await page.getOperatorList();
      const pageImages: ExtractedPageImage[] = [];
      let imageIndex = 0;

      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
          const imgName = ops.argsArray[i][0];
          try {
            let img: any = null;

            if (page.objs.has(imgName)) {
              img = await new Promise<any>((resolve) => page.objs.get(imgName, resolve));
            } else if (page.commonObjs.has(imgName)) {
              img = await new Promise<any>((resolve) => page.commonObjs.get(imgName, resolve));
            } else {
              img = await Promise.race([
                new Promise<any>((resolve) => page.objs.get(imgName, resolve)),
                new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_RESOLVING_IMG')), 2000)),
              ]).catch(() => null);
            }

            if (!img || !img.data || !img.width || !img.height) continue;
            if (img.width < 320 || img.height < 180) continue;

            const aspectRatio = img.width / img.height;
            if (aspectRatio > 3.5 || aspectRatio < 0.28) continue;

            const channels = img.kind === 2 ? 3 : (img.kind === 1 ? 1 : 4);
            const isStacked = img.height > img.width * 1.15 && img.height >= 800;

            if (isStacked) {
              // Documento escaneado en formato vertical con Frente (mitad superior) y Reverso (mitad inferior) en una sola página.
              // Extraer ambas mitades individualmente para que cada cara mantenga 100% de nitidez y OCR/Barcode perfecto.
              const topHalfBuf = await sharp(Buffer.from(img.data), {
                raw: { width: img.width, height: img.height, channels },
              })
                .extract({ left: 0, top: 0, width: img.width, height: Math.floor(img.height * 0.52) })
                .resize({ width: 650, fit: 'inside', withoutEnlargement: true })
                .normalize()
                .png({ compressionLevel: 1 })
                .toBuffer();

              pageImages.push({
                pageNumber: p,
                imageIndex,
                buffer: topHalfBuf,
                width: img.width,
                height: Math.floor(img.height * 0.52),
              });
              imageIndex++;

              const bottomHalfBuf = await sharp(Buffer.from(img.data), {
                raw: { width: img.width, height: img.height, channels },
              })
                .extract({ left: 0, top: Math.floor(img.height * 0.48), width: img.width, height: Math.floor(img.height * 0.52) })
                .resize({ width: 650, fit: 'inside', withoutEnlargement: true })
                .normalize()
                .png({ compressionLevel: 1 })
                .toBuffer();

              pageImages.push({
                pageNumber: p,
                imageIndex,
                buffer: bottomHalfBuf,
                width: img.width,
                height: Math.floor(img.height * 0.52),
              });
              imageIndex++;
            } else {
              // Imagen individual estándar (cédula horizontal o cara aislada)
              let sharpImg = sharp(Buffer.from(img.data), {
                raw: { width: img.width, height: img.height, channels },
              });

              if (img.width > 950 || img.height > 950) {
                sharpImg = sharpImg.resize({
                  width: 950,
                  height: 950,
                  fit: 'inside',
                  withoutEnlargement: true,
                });
              }

              const pngBuffer = await sharpImg.normalize().png({ compressionLevel: 1 }).toBuffer();

              pageImages.push({
                pageNumber: p,
                imageIndex,
                buffer: pngBuffer,
                width: img.width,
                height: img.height,
              });
              imageIndex++;
            }
          } catch (imgErr) {
            console.warn(`[PDF] Omitiendo imagen ${imgName} de página ${p}:`, imgErr);
          }
        }
      }

      if (pageImages.length > 0) {
        await onPageImages(pageImages, p, totalPages);
      }
    }

    return totalPages;
  }
}

export const pdfService = new PdfService();
