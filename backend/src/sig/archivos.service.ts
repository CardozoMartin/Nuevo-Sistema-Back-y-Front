import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export interface ArchivoGuardado {
  /** Ruta relativa a STORAGE_DIR (es lo que se guarda en la base). */
  ruta: string;
  sha256: string;
  bytes: number;
}

/**
 * Guarda los archivos originales que sube el usuario (KML, y más adelante PDF de
 * resoluciones…). Los archivos NO van a la base: se guarda la ruta y los metadatos
 * (criterio de esquema_drh.sql: los BLOB hacen inmanejables los backups).
 *
 * El nombre es el hash SHA-256 del contenido: el mismo archivo subido dos veces ocupa
 * un solo lugar, y el hash permite comprobar después que no fue alterado.
 */
@Injectable()
export class ArchivosService {
  private readonly raiz: string;

  constructor(config: ConfigService) {
    this.raiz = resolve(config.get('STORAGE_DIR', './storage'));
  }

  async guardar(carpeta: string, contenido: Buffer, extension: string): Promise<ArchivoGuardado> {
    const sha256 = createHash('sha256').update(contenido).digest('hex');
    // Subcarpeta con los 2 primeros caracteres del hash: evita miles de archivos en un solo directorio.
    const ruta = join(carpeta, sha256.slice(0, 2), `${sha256}.${extension}`);
    await mkdir(join(this.raiz, carpeta, sha256.slice(0, 2)), { recursive: true });
    await writeFile(join(this.raiz, ruta), contenido);
    return { ruta: ruta.replaceAll('\\', '/'), sha256, bytes: contenido.length };
  }
}
