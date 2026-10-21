import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import * as Minio from 'minio';

const minioClient = new Minio.Client({
  endPoint: 'play.min.io',
  port: 443,
  useSSL: true,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin'
});

// Sử dụng bucket chung 'public' có sẵn trên play.min.io

// Testing
const BUCKET_NAME = 'public';
const OBJECT_NAME = 'map-config-kha.json';

const defaultMapConfig = {
  title: "Hệ thống Bản đồ Trực tuyến",
  logoUrl: "https://tile.openstreetmap.org/12/3262/1925.png",
  zoom: 8,
  center: [10.780074, 106.6876522],
  baseLayers: [
    {
      name: "OpenStreetMap",
      layerUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      thumbnailUrl: "https://tile.openstreetmap.org/12/3262/1925.png"
    }
  ],
  overlays: [
    {
      name: "Khu bảo tồn quốc gia Việt Nam",
      wmsUrl: "https://geoserver.opendevelopmentmekong.net/geoserver/ODVietnam/wms",
      layers: "ODVietnam:Khu bao ton",
      iconUrl: "./1.jpg",
      active: true
    }
  ]
};

// 1. GET /api/config: Đọc file từ MinIO
export const GET: RequestHandler = async () => {
  try {
    const stream = await minioClient.getObject(BUCKET_NAME, OBJECT_NAME);
    let data = '';
    
    for await (const chunk of stream) {
      data += chunk;
    }
    
    return json(JSON.parse(data));
  } catch (error) {
    console.warn("Chưa có file trên MinIO hoặc lỗi đọc, trả về cấu hình mặc định:", error);
    return json(defaultMapConfig);
  }
};

// 2. POST /api/config: Ghi file lên MinIO
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    const jsonString = JSON.stringify(body, null, 2);
    
    const buffer = Buffer.from(jsonString, 'utf-8');
    // Ghi thẳng vào bucket public có sẵn, không gọi lệnh tạo bucket nữa
    await minioClient.putObject(BUCKET_NAME, OBJECT_NAME, buffer);

    return json({ success: true, message: 'Lưu cấu hình lên MinIO thành công!' });
  } catch (error) {
    console.error("Lỗi ghi cấu hình lên MinIO:", error);
    return json({ success: false, error: String(error) }, { status: 500 });
  }
};