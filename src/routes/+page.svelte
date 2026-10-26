<script lang="ts">
  import { onMount } from 'svelte';
  import './jedison.css';

  let mapConfigSchema = {
    type: "object",
    additionalProperties: false,
    title: "Map Configuration",
    properties: {
      title: { type: "string", title: "Map Title" },
      logoUrl: { type: "string", title: "Logo URL" },
      zoom: { type: "integer", title: "Default Zoom Level" },
      markerInfo: {
        type: "object",
        additionalProperties: false,
        title: "Marker Information",
        properties: {
          coords: {
            type: "array",
            title: "Marker Coordinates [lat, lng]",
            items: { type: "number" }
          },
          popupText: { type: "string", title: "Popup Description" }
        }
      },
      baseLayers: {
        type: "array",
        title: "Base Layers List",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", title: "Layer Name" },
            layerUrl: { type: "string", title: "Tile/Layer URL" },
            thumbnailUrl: { type: "string", title: "Thumbnail URL" },
            active: { type: "boolean", title: "Active (Hiển thị mặc định)" }
          }
        }
      },
      overlays: {
        type: "array",
        title: "Overlays List",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", title: "Overlay Name" },
            url: { type: "string", title: "WMS URL" },
            id: { type: "string", title: "Layers ID" },
            iconUrl: { type: "string", title: "Icon URL" },
            active: { type: "boolean", title: "Active (Hiển thị mặc định)" }
          }
        }
      }
    }
  };

  let defaultData = {
    title: "Hệ thống Bản đồ Trực tuyến - Sở Khoa học và Công nghệ TP.HCM",
    logoUrl: "https://tile.openstreetmap.org/12/3262/1925.png",
    zoom: 8,
    markerInfo: {
      coords: [10.780074, 106.6876522],
      popupText: "Sở Khoa học và Công nghệ - 273 Điện Biên Phủ"
    },
    baseLayers: [
      {
        name: "OpenStreetMap",
        layerUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        thumbnailUrl: "https://tile.openstreetmap.org/12/3262/1925.png",
        active: true
      }
    ],
    overlays: [
      {
        name: "Khu bảo tồn quốc gia Việt Nam",
        url: "https://geoserver.opendevelopmentmekong.net/geoserver/ODVietnam/wms",
        id: "ODVietnam:Khu bao ton",
        iconUrl: "./1.jpg",
        active: true
      }
    ]
  };

  let editorContainer: HTMLDivElement;
  let statusMessage = $state('');
  let isSuccess = $state(true);
  let isLoading = $state(true);
  let editorInstance: any = null;

  let centerLat = $state(10.780074);
  let centerLng = $state(106.6876522);

  onMount(async () => {
    let initialData = JSON.parse(JSON.stringify(defaultData));

    try {
      const res = await fetch('/api/config?t=' + Date.now());
      if (res.ok) {
        const json = await res.json();
        if (json && json.title) {
          const coords = json.centerCoordinates || json.center;
          if (coords && coords.length >= 2) {
            centerLat = coords[0];
            centerLng = coords[1];
          }

          delete json.center;
          delete json.centerCoordinates;

          initialData = json;
        }
      }
    } catch (e) {
      console.warn("Dùng cấu hình mặc định:", e);
    }

    try {
      // @ts-ignore
      const jedisonModule = await import('jedison');
      const Jedison = jedisonModule.default;

      if (editorContainer && Jedison) {
        editorInstance = new Jedison.Create({
          container: editorContainer,
          theme: new Jedison.ThemeBootstrap5(),
          schema: mapConfigSchema,
          data: initialData,
          disable_properties: true,
          disable_edit_json: true,
          disable_collapse: true
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
      let rawData = editorInstance.getValue();

      rawData.centerCoordinates = [Number(centerLat) || 0, Number(centerLng) || 0];

      if (rawData) {
        if (Array.isArray(rawData.baseLayers)) {
          rawData.baseLayers = rawData.baseLayers.map((item: any) => ({
            ...item,
            active: item.active === true || item.active === 'true' || item.active === '1'
          }));
        }
        if (Array.isArray(rawData.overlays)) {
          rawData.overlays = rawData.overlays.map((item: any) => ({
            ...item,
            id: item.id || "", // 👈 Quan trọng: Đảm bảo luôn là string để map viewer gọi .trim() không bị lỗi
            active: item.active === true || item.active === 'true' || item.active === '1'
          }));
        }
      }

      statusMessage = "Đang lưu cấu hình...";
      isSuccess = true;
      
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawData)
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

<svelte:head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" />
</svelte:head>

<main class="min-h-screen bg-slate-100/60 py-12 px-4 font-sans text-slate-800">
  <div class="max-w-4xl mx-auto bg-white rounded-3xl shadow-xs border border-slate-200/60 p-8 sm:p-10">
    
    <!-- Tiêu đề trang -->
    <div class="mb-8 pb-5 border-b border-slate-100 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 tracking-tight">Map Configuration Admin</h1>
        <p class="text-sm text-slate-500 mt-1">Quản lý và tinh chỉnh thông số cấu hình hệ thống bản đồ trực quan.</p>
      </div>
      <!-- <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
        API Connected
      </span> -->
    </div>

    <!-- Ô nhập tọa độ trung tâm (Center Coordinates) độc lập ở phía trên -->
    <div class="mb-8 p-6 bg-slate-50/80 rounded-2xl border border-slate-200/70">
      <div class="flex items-center justify-between mb-3">
        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600">
          Center Coordinates (Tâm bản đồ)
        </label>
        <!-- <span class="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">WGS 84</span> -->
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span class="block text-xs font-semibold text-slate-600 mb-1.5">Latitude (Vĩ độ - lat)</span>
          <input 
            type="number" 
            step="any"
            bind:value={centerLat}
            placeholder="10.780074"
            class="w-full px-3.5 py-2.5 bg-slate-50/50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
        <div class="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <span class="block text-xs font-semibold text-slate-600 mb-1.5">Longitude (Kinh độ - lng)</span>
          <input 
            type="number" 
            step="any"
            bind:value={centerLng}
            placeholder="106.6876522"
            class="w-full px-3.5 py-2.5 bg-slate-50/50 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>
    </div>

    {#if isLoading}
      <div class="py-16 text-center text-slate-400 text-sm">Đang tải cấu hình bản đồ...</div>
    {/if}

    <!-- Khu vực Jedison Editor -->
    <div class="mb-8 bg-white" style:display={isLoading ? 'none' : 'block'}>
      <div bind:this={editorContainer} class="custom-jedison-wrapper"></div>
    </div>

    <!-- Nút lưu cấu hình -->
    <div class="pt-6 border-t border-slate-100 flex items-center justify-between">
      <button 
        onclick={handleSave}
        class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-2xl transition-all shadow-sm shadow-blue-500/20 active:scale-[0.98] cursor-pointer">
        Save Config
      </button>

      {#if statusMessage}
        <span class={`font-medium text-sm transition-all ${isSuccess ? 'text-emerald-600' : 'text-rose-600'}`}>
          {statusMessage}
        </span>
      {/if}
    </div>

  </div>
</main>