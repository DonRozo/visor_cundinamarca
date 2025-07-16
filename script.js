require([
    "esri/Map",
    "esri/views/MapView",
    "esri/request",
    "esri/layers/FeatureLayer",
    // Ya no se necesita MapImageLayer con esta lógica
    "esri/widgets/Search",
    "esri/widgets/BasemapGallery",
    "esri/widgets/Measurement",
    "esri/widgets/Print",
    "esri/widgets/Expand",
    "esri/widgets/LayerList",
    "esri/widgets/Legend",
    "esri/widgets/Compass",
    "esri/widgets/Home",
    "esri/widgets/Zoom"
], function (
    Map, MapView, esriRequest, FeatureLayer,
    Search, BasemapGallery, Measurement, Print, Expand,
    LayerList, Legend, Compass, Home, Zoom
) {

    const groupId = "244695359f1d45c4862ed0508d64a335";
    const portalUrl = `https://www.arcgis.com/sharing/rest/search?q=(type:"Feature Service" OR type:"File Geodatabase") AND group:${groupId}&f=json&num=100`;
    const openDataUrlBase = "https://mapasyestadisticas-cundinamarca-map.opendata.arcgis.com/datasets/";

    const map = new Map({ basemap: "topo-vector" });
    const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-74.08175, 4.60971],
        zoom: 8,
        padding: {
            left: 360
        },
        ui: {
            components: ["attribution"]
        }
    });

    const cardContainer = document.getElementById("card-container");
    const searchInput = document.getElementById("search-input");
    const detailPane = document.getElementById("detail-pane");

    let allItems = [];
    let featureServices = [];
    const gdbIdLookup = new Map();

    esriRequest(portalUrl, { responseType: "json" })
        .then(response => {
            allItems = response.data.results;
            allItems.forEach(item => {
                if (item.type === "File Geodatabase" && item.title.endsWith("_gdb")) {
                    const baseName = item.title.slice(0, -4);
                    gdbIdLookup.set(baseName, item.id);
                }
            });
            featureServices = allItems.filter(item => item.type === "Feature Service");
            displayLayers(featureServices);
        })
        .catch(error => console.error("Error al buscar ítems:", error));

    function displayLayers(items) {
        cardContainer.style.display = 'flex';
        detailPane.style.display = 'none';
        cardContainer.innerHTML = "";
        items.forEach(item => {
            const thumbnailUrl = item.thumbnail ? `https://www.arcgis.com/sharing/rest/content/items/${item.id}/info/${item.thumbnail}` : 'https://www.arcgis.com/home/images/shared/bb_results-no-preview.png';
            const card = document.createElement('div');
            card.className = 'card';
            card.innerHTML = `
                <div class="card-inner">
                    <div class="card-front">
                        <img src="${thumbnailUrl}" alt="${item.title}">
                        <div class="card-title">${item.title}</div>
                    </div>
                    <div class="card-back">
                        <p>${item.snippet || "No hay resumen disponible."}</p>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => showDetails(item));
            cardContainer.appendChild(card);
        });
    }

    function showDetails(item) {
        cardContainer.style.display = 'none';
        const thumbnailUrl = item.thumbnail ? `https://www.arcgis.com/sharing/rest/content/items/${item.id}/info/${item.thumbnail}` : 'https://www.arcgis.com/home/images/shared/bb_results-no-preview.png';
        
        detailPane.innerHTML = `
            <img src="${thumbnailUrl}" alt="${item.title}" class="detail-thumbnail">
            <h3>${item.title}</h3>
            <p class="detail-description">${item.description || item.snippet || "No hay descripción disponible."}</p>
            <div class="metadata-buttons">
                <button id="detail-add-btn" class="pill-button">Añadir al Mapa</button>
                <a id="detail-download-link" class="pill-button" target="_blank">Descargar GDB</a>
                <button id="back-to-search-btn" class="pill-button secondary">← Volver a la búsqueda</button>
            </div>
        `;
        detailPane.style.display = 'block';

        const addBtn = document.getElementById('detail-add-btn');
        const downloadLink = document.getElementById('detail-download-link');
        const backBtn = document.getElementById('back-to-search-btn');

        // ✅ LÓGICA DE AÑADIR CAPAS COMPLETAMENTE RESTAURADA Y FUNCIONAL
        addBtn.onclick = () => {
            // Revisa si las capas de este servicio ya fueron añadidas
            const existingLayers = map.layers.filter(lyr => lyr.groupId === item.id);
            if (existingLayers.length > 0) {
                view.goTo(existingLayers.getItemAt(0).fullExtent);
                return;
            }

            // Si no, inspecciona el servicio para añadir todas sus sub-capas
            esriRequest(item.url, { query: { f: "json" }, responseType: "json" })
                .then(serviceInfo => {
                    if (serviceInfo.data.layers && serviceInfo.data.layers.length > 0) {
                        const layersToAdd = serviceInfo.data.layers.map(layerInfo => {
                            return new FeatureLayer({
                                url: `${item.url}/${layerInfo.id}`,
                                title: layerInfo.name,
                                id: `${item.id}_${layerInfo.id}`,
                                groupId: item.id
                            });
                        });
                        map.addMany(layersToAdd);
                    } else {
                        const singleLayer = new FeatureLayer({
                            url: item.url,
                            id: item.id,
                            title: item.title,
                            groupId: item.id
                        });
                        map.add(singleLayer);
                    }
                }).catch(err => console.error("Error al añadir la capa:", err));
        };

        const gdbId = gdbIdLookup.get(item.title);
        if (gdbId) {
            downloadLink.href = `${openDataUrlBase}${gdbId}/about`;
            downloadLink.style.display = 'block';
        } else {
            downloadLink.style.display = 'none';
        }
        
        backBtn.onclick = () => {
            const currentSearchTerm = searchInput.value;
            filterAndDisplayLayers(currentSearchTerm);
        };
    }
    
    function filterAndDisplayLayers(searchTerm) {
        const lowerCaseTerm = searchTerm.toLowerCase().trim();
        const filtered = featureServices.filter(item => 
            item.title.toLowerCase().includes(lowerCaseTerm)
        );
        displayLayers(filtered);
    }

    searchInput.addEventListener("input", e => {
        filterAndDisplayLayers(e.target.value);
    });
    
    // --- WIDGETS DE MAPA ---
    const searchWidget = new Search({ view: view, container: "search-widget-container" });
    const basemapGallery = new BasemapGallery({ view: view });
    const print = new Print({ view: view, printServiceUrl: "https://utility.arcgisonline.com/arcgis/rest/services/Utilities/PrintingTools/GPServer/Export%20Web%20Map%20Task" });
    const measurement = new Measurement({ view: view });
    view.ui.add(new Expand({ view: view, content: basemapGallery, expandIcon: "basemap" }), "top-right");
    view.ui.add(new Expand({ view: view, content: print, expandIcon: "print" }), "top-right");
    view.ui.add(measurement, "bottom-right");
    const layerListWidget = new LayerList({ view: view });
    view.ui.add(new Expand({ view: view, content: layerListWidget, expandIcon: "layers" }), "top-left");
    const legendWidget = new Legend({ view: view });
    view.ui.add(new Expand({ view: view, content: legendWidget, expandIcon: "legend" }), "top-left");
    const zoom = new Zoom({ view: view });
    view.ui.add(zoom, "top-left");
    const compass = new Compass({ view: view });
    view.ui.add(compass, "top-left");
    const home = new Home({ view: view });
    view.ui.add(home, "top-left");
});