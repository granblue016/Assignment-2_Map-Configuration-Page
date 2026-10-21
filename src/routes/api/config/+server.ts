import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs';
import path from 'path';

const configFilePath = path.resolve('static/map-config.json');

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

// 1. GET /api/config: Đọc file từ thư mục static cục bộ
export const GET: RequestHandler = async () => {
  try {
    if (fs.existsSync(configFilePath)) {
      const fileContent = fs.readFileSync(configFilePath, 'utf-8');
      return json(JSON.parse(fileContent));
    }
    return json(defaultMapConfig);
  } catch (error) {
    console.error("Lỗi đọc file cấu hình:", error);
    return json(defaultMapConfig);
  }
};

// 2. POST /api/config: Ghi đè file cấu hình vào thư mục static cục bộ
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    fs.writeFileSync(configFilePath, JSON.stringify(body, null, 2), 'utf-8');
    return json({ success: true, message: 'Lưu cấu hình thành công!' });
  } catch (error) {
    console.error("Lỗi ghi file cấu hình:", error);
    return json({ success: false, error: String(error) }, { status: 500 });
  }
};