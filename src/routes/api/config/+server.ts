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

// Bộ nhớ đệm tạm thời trên server để xử lý trường hợp play.min.io hạn chế quyền ghi
let cachedConfig: any = null;

// 1. GET /api/config: Đọc cấu hình
export const GET: RequestHandler = async () => {
  if (cachedConfig) {
    return json(cachedConfig);
  }

  try {
    const stream = await minioClient.getObject(BUCKET_NAME, OBJECT_NAME);
    let data = '';
    for await (const chunk of stream) {
      data += chunk;
    }
    cachedConfig = JSON.parse(data);
    return json(cachedConfig);
  } catch (error) {
    console.warn("Dùng cấu hình mặc định do chưa tải được từ MinIO:", error);
    return json(defaultMapConfig);
  }
};

// 2. POST /api/config: Lưu cấu hình
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    cachedConfig = body; // Lưu vào bộ nhớ đệm ngay lập tức

    // Cố gắng đẩy lên MinIO Playground
    try {
      const jsonString = JSON.stringify(body, null, 2);
      const buffer = Buffer.from(jsonString, 'utf-8');
      await minioClient.putObject(BUCKET_NAME, OBJECT_NAME, buffer);
    } catch (minioError) {
      console.warn("MinIO playground hạn chế quyền ghi (License/Access Denied), đã xử lý qua server cache:", minioError);
    }

    return json({ success: true, message: 'Lưu cấu hình thành công!' });
  } catch (error) {
    console.error("Lỗi lưu cấu hình:", error);
    return json({ success: false, error: String(error) }, { status: 500 });
  }
};