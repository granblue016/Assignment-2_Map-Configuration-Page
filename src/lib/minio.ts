import * as Minio from 'minio';

export const minioClient = new Minio.Client({
  endPoint: 'play.min.io',
  port: 443,
  useSSL: true,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin'
});

export const BUCKET_NAME = 'public'; // Dùng bucket 'public' có sẵn trên playground
export const CONFIG_PATH = 'map-config-kha.json';