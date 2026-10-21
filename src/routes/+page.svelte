<script lang="ts">
  import { onMount } from 'svelte';

  let mapConfigSchema = {
    type: "object",
    title: "Cấu hình Bản đồ",
    properties: {
      title: { type: "string", title: "Tiêu đề bản đồ" },
      logoUrl: { type: "string", title: "URL Logo" },
      zoom: { type: "integer", title: "Mức Zoom mặc định" },
      center: {
        type: "array",
        title: "Tọa độ trung tâm [lat, lng]",
        items: { type: "number" }
      },
      baseLayers: {
        type: "array",
        title: "Danh sách bản đồ nền (baseLayers)",
        items: {
          type: "object",
          properties: {
            name: { type: "string", title: "Tên lớp nền" },
            layerUrl: { type: "string", title: "URL Tile/Layer" },
            thumbnailUrl: { type: "string", title: "URL Thumbnail" }
          }
        }
      },
      overlays: {
        type: "array",
        title: "Danh sách lớp phủ dữ liệu (overlays)",
        items: {
          type: "object",
          properties: {
            name: { type: "string", title: "Tên lớp phủ" },
            wmsUrl: { type: "string", title: "URL WMS" },
            layers: { type: "string", title: "Mã định danh Layers ID" },
            iconUrl: { type: "string", title: "URL Icon" },
            active: { type: "boolean", title: "Hiển thị mặc định (active)" }
          }
        }
      }
    }
  };

  let defaultData = {
    title: "Hệ thống Bản đồ Trực tuyến - Đại học Sài Gòn",
    logoUrl: "https://tile.openstreetmap.org/12/3262/1925.png",
    zoom: 8,
    center: [10.780074, 106.6876522],
    baseLayers: [
      {
        name: "OpenStreetMap",
        layerUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        thumbnailUrl: "https://tile.openstreetmap.org/12/3262/1925.png"
      },
      {
        name: "Vệ tinh",
        layerUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        thumbnailUrl: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1925/3262.png"
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
        name: "Tuần suât lũ lụt",
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
        iconUrl: "./4.jpg",
        active: false
      },
      {
        name: "Các dự án hộ trợ của ngân hàng thế giới tại Việt Nam",
        wmsUrl: "https://geoserver.opendevelopmentmekong.net/geoserver/ODVietnam/wms",
        layers: "ODVietnam:World_bank_aid_vn",
        iconUrl: "./5.jpg",
        active: false
      }
    ]
  };

  let editorContainer: HTMLDivElement;
  
  // Khai báo trạng thái chuẩn Svelte 5 bằng $state
  let statusMessage = $state('');
  let isSuccess = $state(true);
  let isLoading = $state(true);
  let editorInstance: any = null;

  onMount(async () => {
    let initialData = defaultData;
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const json = await res.json();
        if (json && !json.error) {
          initialData = json;
        }
      }
    } catch (e) {
      console.warn("Sử dụng dữ liệu mặc định do không gọi được API:", e);
    }

    try {
      // @ts-ignore
      const jedisonModule = await import('jedison');
      const Jedison = jedisonModule.default;

      if (editorContainer && Jedison) {
        editorInstance = new Jedison.Create({
          container: editorContainer,
          theme: new Jedison.Theme(),
          schema: mapConfigSchema,
          data: initialData
        });
      }
    } catch (e) {
      console.error("Lỗi khởi tạo Jedison:", e);
    } finally {
      isLoading = false; 
    }
  });

  async function handleSave() {
    if (!editorInstance) return;

    try {
      const currentData = editorInstance.getValue();
      statusMessage = "Đang lưu cấu hình...";
      isSuccess = true;
      
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentData)
      });

      const result = await response.json();
      if (result.success) {
        statusMessage = "Lưu cấu hình thành công!";
        isSuccess = true;
      } else {
        statusMessage = "Lưu thất bại: " + (result.error || 'Lỗi server');
        isSuccess = false;
      }
    } catch (err) {
      console.error(err);
      statusMessage = "Lỗi kết nối khi lưu!";
      isSuccess = false;
    }

    setTimeout(() => statusMessage = '', 5000);
  }
</script>

<main class="min-h-screen bg-gray-50 p-6">
  <div class="max-w-4xl mx-auto bg-white rounded-xl shadow-md p-6">
    <h1 class="text-2xl font-bold text-gray-800 mb-2">Trang Cấu Hình Bản Đồ (Map Config Admin)</h1>
    <p class="text-sm text-gray-500 mb-6">Chỉnh sửa trực quan các thông số cấu hình bản đồ thông qua JSON Editor.</p>

    {#if isLoading}
      <div class="py-12 text-center text-gray-500">Đang tải cấu hình bản đồ...</div>
    {/if}

    <!-- Khu vực hiển thị JSON Editor -->
    <div class="border border-gray-200 rounded-lg p-4 mb-6 min-h-[350px] bg-white" style:display={isLoading ? 'none' : 'block'}>
      <div bind:this={editorContainer}></div>
    </div>

    <!-- Thanh công cụ / Nút lưu -->
    <div class="flex items-center justify-between">
      <button 
        onclick={handleSave}
        class="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-all shadow-sm cursor-pointer">
        Save Config
      </button>

      {#if statusMessage}
        <span class={`font-medium text-sm ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
          {statusMessage}
        </span>
      {/if}
    </div>
  </div>
</main>