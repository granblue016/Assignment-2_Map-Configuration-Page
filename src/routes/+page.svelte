<script lang="ts">
  import { onMount, tick } from 'svelte';
  import './jedison.css';

  // 1. Quản lý tọa độ Center hiển thị giao diện 2 cột đẹp mắt
  let centerLat = $state(10.780074);
  let centerLng = $state(106.6876522);

  // Schema phần 1: Thông tin chung (Title, Logo, Zoom)
  let generalSchema = {
    type: 'object',
    additionalProperties: false,
    title: 'Map Configuration',
    properties: {
      title: { type: 'string', title: 'Map Title' },
      logoUrl: { type: 'string', title: 'Logo URL' },
      zoom: { type: 'integer', title: 'Default Zoom Level' }
    }
  };

  // Schema phần 2: Danh sách các lớp (Base Layers & Overlays)
  let layersSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      baseLayers: {
        type: 'array',
        title: 'Base Layers List',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', title: 'Layer Name' },
            layerUrl: { type: 'string', title: 'Tile/Layer URL' },
            thumbnailUrl: { type: 'string', title: 'Thumbnail URL' }
          }
        }
      },
      overlays: {
        type: 'array',
        title: 'Overlays List',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', title: 'Overlay Name' },
            wmsUrl: { type: 'string', title: 'WMS URL' },
            layers: { type: 'string', title: 'Layers ID' },
            iconUrl: { type: 'string', title: 'Icon URL' },
            active: { type: 'boolean', title: 'Active (Hiển thị mặc định)' }
          }
        }
      }
    }
  };

  // Dữ liệu mặc định
  let defaultData = {
    title: 'Hệ thống Bản đồ Trực tuyến - Sở Khoa học và Công nghệ TP.HCM',
    logoUrl: 'https://tile.openstreetmap.org/12/3262/1925.png',
    zoom: 8,
    center: [10.780074, 106.6876522],
    baseLayers: [
      {
        name: 'OpenStreetMap',
        layerUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        thumbnailUrl: 'https://tile.openstreetmap.org/12/3262/1925.png'
      },
      {
        name: 'Vệ tinh',
        layerUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        thumbnailUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1925/3262.png'
      }
    ],
    overlays: [
      {
        name: 'Khu bảo tồn quốc gia Việt Nam',
        wmsUrl: 'https://geoserver.opendevelopmentmekong.net/geoserver/ODVietnam/wms',
        layers: 'ODVietnam:Khu bao ton',
        iconUrl: './1.jpg',
        active: true
      }
    ]
  };

  let editorGeneralContainer: HTMLDivElement;
  let editorLayersContainer: HTMLDivElement;
  let statusMessage = $state('');
  let isSuccess = $state(true);
  let isLoading = $state(true);
  let editorGeneralInstance: any = null;
  let editorLayersInstance: any = null;

  onMount(async () => {
    let initialData = JSON.parse(JSON.stringify(defaultData));

    try {
      const res = await fetch('/api/config?t=' + Date.now());
      if (res.ok) {
        const json = await res.json();
        if (json && json.title) {
          initialData = json;
        }
      }
    } catch (e) {
      console.warn('Dùng cấu hình mặc định:', e);
    }

    // Tách dữ liệu ra cho 2 instance
    if (Array.isArray(initialData.center) && initialData.center.length >= 2) {
      centerLat = initialData.center[0];
      centerLng = initialData.center[1];
    }

    const generalData = {
      title: initialData.title || '',
      logoUrl: initialData.logoUrl || '',
      zoom: initialData.zoom ?? 8
    };

    const layersData = {
      baseLayers: Array.isArray(initialData.baseLayers) ? initialData.baseLayers : [],
      overlays: Array.isArray(initialData.overlays) ? initialData.overlays : []
    };

    try {
      // @ts-ignore
      const jedisonModule = await import('jedison');
      const Jedison = jedisonModule.default;

      if (editorGeneralContainer && editorLayersContainer && Jedison) {
        // Khởi tạo Editor phần 1 (General)
        editorGeneralInstance = new Jedison.Create({
          container: editorGeneralContainer,
          theme: new Jedison.ThemeBootstrap5(),
          schema: generalSchema,
          data: generalData,
          disable_properties: true,
          disable_edit_json: true,
          disable_collapse: true
        });

        // Khởi tạo Editor phần 2 (Layers)
        editorLayersInstance = new Jedison.Create({
          container: editorLayersContainer,
          theme: new Jedison.ThemeBootstrap5(),
          schema: layersSchema,
          data: layersData,
          disable_properties: true,
          disable_edit_json: true,
          disable_collapse: true
        });

        await tick();
      }
    } catch (e) {
      console.error('Lỗi khởi tạo Jedison:', e);
    } finally {
      isLoading = false; 
    }
  });

  async function handleSave() {
    if (!editorGeneralInstance || !editorLayersInstance) return;

    try {
      const generalVal = editorGeneralInstance.getValue();
      const layersVal = editorLayersInstance.getValue();

      // Đóng gói lại thành object JSON hoàn chỉnh theo đúng thứ tự yêu cầu
      let rawData = {
        ...generalVal,
        center: [Number(centerLat) || 0, Number(centerLng) || 0],
        ...layersVal
      };

      statusMessage = 'Đang lưu cấu hình...';
      isSuccess = true;

      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rawData)
      });

      const result = await response.json();
      if (result.success) {
        statusMessage = 'Lưu cấu hình thành công!';
        isSuccess = true;
      } else {
        statusMessage = 'Lưu thất bại: ' + (result.error || 'Lỗi server');
        isSuccess = false;
      }
    } catch (err) {
      console.error(err);
      statusMessage = 'Lỗi kết nối khi lưu!';
      isSuccess = false;
    }

    setTimeout(() => (statusMessage = ''), 5000);
  }
</script>

<svelte:head>
  <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css"
  />
</svelte:head>

<main class="min-h-screen bg-slate-100/60 px-4 py-12 font-sans text-slate-800">
  <div
    class="mx-auto max-w-4xl rounded-3xl border border-slate-200/60 bg-white p-8 shadow-xs sm:p-10"
  >
    <div class="mb-8 flex items-center justify-between border-b border-slate-100 pb-5">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-slate-900">Map Configuration Admin</h1>
        <p class="mt-1 text-sm text-slate-500">
          Quản lý và tinh chỉnh thông số cấu hình hệ thống bản đồ trực quan.
        </p>
      </div>
    </div>

    {#if isLoading}
      <div class="py-16 text-center text-sm text-slate-400">Đang tải cấu hình bản đồ...</div>
    {/if}

    <!-- 1. Jedison Phần 1: Map Title, Logo URL, Default Zoom Level -->
    <div class="mb-2 bg-white" style:display={isLoading ? 'none' : 'block'}>
      <div bind:this={editorGeneralContainer} class="custom-jedison-wrapper"></div>
    </div>

    <!-- 2. Khung nhập tọa độ Center nằm ở giữa (phía dưới Map Configuration) -->
    <div class="mb-6 rounded-2xl border border-slate-200 p-6 bg-slate-50/50" style:display={isLoading ? 'none' : 'block'}>
      <div class="text-lg font-bold uppercase tracking-wider text-slate-700 mb-4">
        Center Coordinates (Tâm bản đồ)
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="lat-input" class="block text-xs font-semibold text-slate-600 mb-1.5">Latitude (Vĩ độ - lat)</label>
          <input
            id="lat-input"
            type="number"
            step="any"
            bind:value={centerLat}
            class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div>
          <label for="lng-input" class="block text-xs font-semibold text-slate-600 mb-1.5">Longitude (Kinh độ - lng)</label>
          <input
            id="lng-input"
            type="number"
            step="any"
            bind:value={centerLng}
            class="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>
    </div>

    <!-- 3. Jedison Phần 2: Base Layers & Overlays -->
    <div class="mb-8 bg-white" style:display={isLoading ? 'none' : 'block'}>
      <div bind:this={editorLayersContainer} class="custom-jedison-wrapper"></div>
    </div>

    <!-- Nút lưu cấu hình -->
    <div class="flex items-center justify-between border-t border-slate-100 pt-6">
      <button
        onclick={handleSave}
        class="cursor-pointer rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-[0.98]"
      >
        Save Config
      </button>

      {#if statusMessage}
        <span
          class={`text-sm font-medium transition-all ${isSuccess ? 'text-emerald-600' : 'text-rose-600'}`}
        >
          {statusMessage}
        </span>
      {/if}
    </div>
  </div>
</main>