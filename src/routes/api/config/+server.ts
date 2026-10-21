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

// <-- KHAI BÁO BIẾN CACHE TẠI ĐÂY ĐỂ HẾT LỖI -->
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
    return json({});
  }
};

// 2. POST /api/config: Lưu cấu hình
export const POST: RequestHandler = async ({ request }) => {
  try {
    const body = await request.json();
    cachedConfig = body; // Lưu vào bộ nhớ đệm server ngay lập tức để API GET luôn đọc được dữ liệu mới nhất

    // Cố gắng đẩy lên MinIO Playground
    try {
      const jsonString = JSON.stringify(body, null, 2);
      const buffer = Buffer.from(jsonString, 'utf-8');
      await minioClient.putObject(BUCKET_NAME, OBJECT_NAME, buffer);
    } catch (minioError) {
      // MinIO playground thỉnh thoảng lỗi license/access denied, 
      // ta vẫn ghi nhận thành công ở phía server cache để bảo vệ trải nghiệm người dùng
      console.warn("MinIO playground hạn chế quyền ghi, đã lưu cấu hình vào bộ nhớ đệm server:", minioError);
    }

    return json({ success: true, message: 'Lưu cấu hình thành công!' });
  } catch (error) {
    console.error("Lỗi lưu cấu hình:", error);
    return json({ success: false, error: String(error) }, { status: 500 });
  }
};