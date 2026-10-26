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
const OBJECT_NAME = 'configs/map-config.json';

const defaultMapConfig = {
  title: "Hệ thống Bản đồ Trực tuyến - Sở khoa học và Công nghệ TP.HCM",
  logoUrl: "https://tile.openstreetmap.org/12/3262/1925.png",
  zoom: 8,
  center: [10.780074, 106.6876522],
  baseLayers: [
    {
      name: "OpenStreetMap",
      layerUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      thumbnailUrl: "https://tile.openstreetmap.org/12/3262/1925.png",
      // active: true
    },
    {
      name: "Vệ tinh",
      layerUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      thumbnailUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1925/3262.png",
      // active: false
    }
  ],
  overlays: [
    {
      name: "Khu bảo tồn quốc gia Việt Nam",
      wmsUrl: "https://geoserver.opendevelopmentmekong.net/geoserver/ODVietnam/wms",
      layers: "ODVietnam:Khu bao ton",
      iconUrl: "./1.jpg",
      active: true
    },
    {
      name: "Tuần suất lũ lụt",
      wmsUrl: "https://geoserver.opendevelopmentmekong.net/geoserver/ODVietnam/wms",
      layers: "ODVietnam:Flood_frequency-contour",
      iconUrl: "./2.jpg",
      active: false
    },
    {
      name: "Covid-19",
      wmsUrl: "https://geoserver.opendevelopmentmekong.net/geoserver/ODVietnam/wms",
      layers: "ODVietnam:10453931-345b-40fb-adc0-35eca5831381",
      iconUrl: "./3.png",
      active: false
    },
    {
      name: "Danh sách di sản thế giới tại Việt Nam",
      wmsUrl: "https://geoserver.opendevelopmentmekong.net/geoserver/ODVietnam/wms",
      layers: "ODVietnam:World Heritage Site of Vietnam (V.vietnamese)",
      iconUrl: "./4.webp",
      active: false
    },
    {
      name: "Các dự án hỗ trợ của ngân hàng thế giới tại Việt Nam",
      wmsUrl: "https://geoserver.opendevelopmentmekong.net/geoserver/ODVietnam/wms",
      layers: "ODVietnam:World_bank_aid_vn",
      iconUrl: "./5.png",
      active: false
    }
  ]
};

let cachedConfig: any = null;

// Cấu hình Header CORS cho phép gọi chéo giữa các port (Admin vs Map Client)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
};

// Xử lý preflight request cho CORS
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, { headers: corsHeaders });
};

export const GET: RequestHandler = async () => {
  if (cachedConfig) {
    return json(cachedConfig, { headers: corsHeaders });
  }

  try {
    const stream = await minioClient.getObject(BUCKET_NAME, OBJECT_NAME);
    let data = '';
    for await (const chunk of stream) {
      data += chunk;
    }
    const parsed = JSON.parse(data);
    
    if (parsed && parsed.title && Array.isArray(parsed.overlays) && Array.isArray(parsed.baseLayers)) {
      cachedConfig = parsed;
      return json(cachedConfig, { headers: corsHeaders });
    }
    return json(defaultMapConfig, { headers: corsHeaders });
  } catch (error) {
    console.warn("Dùng cấu hình mặc định do chưa tải được từ MinIO:", error);
    return json(defaultMapConfig, { headers: corsHeaders });
  }
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();

    // 🛡️ BỔ SUNG QUAN TRỌNG: Chuẩn hóa baseLayers đảm bảo tuân thủ tuyệt đối quy tắc chọn 1 (Radio Button)
    if (body && Array.isArray(body.baseLayers)) {
      let activeBaseFound = false;
      body.baseLayers = body.baseLayers.map((item: any) => {
        const isActive = item.active === true || item.active === 'true' || item.active === '1' || item.active === 1;
        if (isActive && !activeBaseFound) {
          activeBaseFound = true;
          return {
            name: item.name || '',
            layerUrl: item.layerUrl || '',
            thumbnailUrl: item.thumbnailUrl || '',
            active: true
          };
        }
        return {
          name: item.name || '',
          layerUrl: item.layerUrl || '',
          thumbnailUrl: item.thumbnailUrl || '',
          active: false
        };
      });

      // Nếu lỡ không có cái nào active, ép cái đầu tiên thành true
      if (!activeBaseFound && body.baseLayers.length > 0) {
        body.baseLayers[0].active = true;
      }
    }

    // Chuẩn hóa dữ liệu overlays: ép mọi giá trị active thành kiểu boolean thuần túy
    if (body && Array.isArray(body.overlays)) {
      body.overlays = body.overlays.map((item: any) => ({
        name: item.name || '',
        wmsUrl: item.wmsUrl || '',
        layers: item.layers || '',
        iconUrl: item.iconUrl || '',
        active: item.active === true || item.active === 'true' || item.active === '1' || item.active === 1
      }));
    }

    // Lưu vào biến cache trên RAM
    cachedConfig = body;

    // Đồng bộ lên MinIO (nếu lỗi quyền ghi thì vẫn chạy ổn định nhờ cache RAM)
    try {
      const jsonString = JSON.stringify(body, null, 2);
      const buffer = Buffer.from(jsonString, 'utf-8');
      await minioClient.putObject(BUCKET_NAME, OBJECT_NAME, buffer);
    } catch (minioError) {
      console.warn("Lưu qua bộ nhớ tạm server do lỗi MinIO:", minioError);
    }

    return json({ success: true, message: 'Lưu cấu hình thành công!' }, { headers: corsHeaders });
  } catch (error) {
    return json({ success: false, error: String(error) }, { status: 500, headers: corsHeaders });
  }
};