<script lang="ts">
	import { onMount } from 'svelte';
	import './jedison.css';

	let mapConfigSchema = {
		type: 'object',
		additionalProperties: false,
		title: 'Map Configuration',
		properties: {
			title: { type: 'string', title: 'Map Title' },
			logoUrl: { type: 'string', title: 'Logo URL' },
			zoom: { type: 'integer', title: 'Default Zoom Level' },
			markerInfo: {
				type: 'object',
				additionalProperties: false,
				title: 'Marker Information',
				properties: {
					coords: {
						type: 'array',
						title: 'Marker Coordinates [lat, lng]',
						items: { type: 'number' }
					},
					popupText: { type: 'string', title: 'Popup Description' }
				}
			},
			baseLayers: {
				type: 'array',
				title: 'Base Layers List',
				items: {
					type: 'object',
					additionalProperties: false,
					properties: {
						name: { type: 'string', title: 'Layer Name' },
						layerUrl: { type: 'string', title: 'Tile/Layer URL' },
						thumbnailUrl: { type: 'string', title: 'Thumbnail URL' },
						active: { type: 'boolean', title: 'Active (Hiển thị mặc định)' }
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
						layers: { type: 'string', title: 'Layers ID' }, // 👈 Đổi từ 'id' thành 'layers' cho khớp với JSON mẫu
						iconUrl: { type: 'string', title: 'Icon URL' },
						active: { type: 'boolean', title: 'Active (Hiển thị mặc định)' }
					}
				}
			}
		}
	};

	let defaultData = {
		title: 'Hệ thống Bản đồ Trực tuyến - Sở Khoa học và Công nghệ TP.HCM',
		logoUrl: 'https://tile.openstreetmap.org/12/3262/1925.png',
		zoom: 8,
		markerInfo: {
			coords: [10.780074, 106.6876522],
			popupText: 'Sở Khoa học và Công nghệ - 273 Điện Biên Phủ'
		},
		baseLayers: [
			{
				name: 'OpenStreetMap',
				layerUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
				thumbnailUrl: 'https://tile.openstreetmap.org/12/3262/1925.png',
				active: true
			}
		],
		overlays: [
			{
				name: 'Khu bảo tồn quốc gia Việt Nam',
				url: 'https://geoserver.opendevelopmentmekong.net/geoserver/ODVietnam/wms',
				id: 'ODVietnam:Khu bao ton',
				iconUrl: './1.jpg',
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

					// Đảm bảo các đối tượng overlay có đủ thuộc tính layers và wmsUrl
					if (Array.isArray(json.overlays)) {
						json.overlays = json.overlays.map((item: any) => ({
							...item,
							layers: item.layers || item.id || '',
							wmsUrl: item.wmsUrl || item.url || '',
							active: item.active === true || item.active === 'true' || item.active === '1'
						}));
					}

					initialData = json;
				}
			}
		} catch (e) {
			console.warn('Dùng cấu hình mặc định:', e);
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
			console.error('Lỗi khởi tạo Jedison:', e);
		} finally {
			isLoading = false;
		}
	});

	async function handleSave() {
		if (!editorInstance) return;

		try {
			let rawData = editorInstance.getValue();

			// Đưa tọa độ lat/lng từ 2 ô input riêng biệt vào mảng center (khớp với JSON mẫu của bạn)
			rawData.center = [Number(centerLat) || 0, Number(centerLng) || 0];
			delete rawData.centerCoordinates; // Dọn dẹp nếu có thừa

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
						layers: item.layers || item.id || '', // Đồng bộ trường layers cho chuẩn với map viewer
						wmsUrl: item.wmsUrl || item.url || '',
						active: item.active === true || item.active === 'true' || item.active === '1'
					}));
				}
			}

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
		<!-- Tiêu đề trang -->
		<div class="mb-8 flex items-center justify-between border-b border-slate-100 pb-5">
			<div>
				<h1 class="text-2xl font-bold tracking-tight text-slate-900">Map Configuration Admin</h1>
				<p class="mt-1 text-sm text-slate-500">
					Quản lý và tinh chỉnh thông số cấu hình hệ thống bản đồ trực quan.
				</p>
			</div>
			<!-- <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
        API Connected
      </span> -->
		</div>

		<!-- Ô nhập tọa độ trung tâm (Center Coordinates) độc lập ở phía trên -->
		<div class="mb-8 rounded-2xl border border-slate-200/70 bg-slate-50/80 p-6">
			<div class="mb-3 flex items-center justify-between">
				<label class="block text-xs font-bold tracking-wider text-slate-600 uppercase">
					Center Coordinates (Tâm bản đồ)
				</label>
				<!-- <span class="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">WGS 84</span> -->
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
					<span class="mb-1.5 block text-xs font-semibold text-slate-600"
						>Latitude (Vĩ độ - lat)</span
					>
					<input
						type="number"
						step="any"
						bind:value={centerLat}
						placeholder="10.780074"
						class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
					/>
				</div>
				<div class="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
					<span class="mb-1.5 block text-xs font-semibold text-slate-600"
						>Longitude (Kinh độ - lng)</span
					>
					<input
						type="number"
						step="any"
						bind:value={centerLng}
						placeholder="106.6876522"
						class="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-slate-800 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
					/>
				</div>
			</div>
		</div>

		{#if isLoading}
			<div class="py-16 text-center text-sm text-slate-400">Đang tải cấu hình bản đồ...</div>
		{/if}

		<!-- Khu vực Jedison Editor -->
		<div class="mb-8 bg-white" style:display={isLoading ? 'none' : 'block'}>
			<div bind:this={editorContainer} class="custom-jedison-wrapper"></div>
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
