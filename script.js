// script.js
// Initialize Lucide Icons initially
lucide.createIcons();

const body = document.getElementById('app-body');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const btnLocation = document.getElementById('btn-location');

// UI Elements
const loadingState = document.getElementById('loading-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const weatherContent = document.getElementById('weather-content');

// Default Location (Ljubljana) if geolocation fails or is denied
const DEFAULT_LOC = { name: "Ljubljana", lat: 46.0569, lon: 14.5058 };
let chartInstance = null;
let appWeatherState = null;
let currentCityName = "";

// Map WMO Weather codes to Lucide Icons, Backgrounds, and Descriptions
const getWeatherInfo = (code, isDay) => {
    let icon, bgClass, desc;
    if (code === 0) {
        icon = isDay ? 'sun' : 'moon';
        bgClass = isDay ? 'bg-sunny' : 'bg-night';
        desc = isDay ? 'Jasno' : 'Jasna noč';
    } else if (code === 1 || code === 2) {
        icon = isDay ? 'cloud-sun' : 'cloud-moon';
        bgClass = isDay ? 'bg-sunny' : 'bg-night';
        desc = 'Delno oblačno';
    } else if (code === 3) {
        icon = 'cloud';
        bgClass = 'bg-cloudy';
        desc = 'Oblačno';
    } else if (code >= 45 && code <= 48) {
        icon = 'cloud-fog';
        bgClass = 'bg-cloudy';
        desc = 'Megla';
    } else if (code >= 51 && code <= 57) {
        icon = 'cloud-drizzle';
        bgClass = 'bg-rainy';
        desc = 'Pršenje';
    } else if (code >= 61 && code <= 67) {
        icon = 'cloud-rain';
        bgClass = 'bg-rainy';
        desc = 'Dež';
    } else if (code >= 71 && code <= 77) {
        icon = 'cloud-snow';
        bgClass = 'bg-snowy';
        desc = 'Sneg';
    } else if (code >= 80 && code <= 82) {
        icon = 'cloud-rain';
        bgClass = 'bg-rainy';
        desc = 'Plohe';
    } else if (code >= 85 && code <= 86) {
        icon = 'cloud-snow';
        bgClass = 'bg-snowy';
        desc = 'Snežne plohe';
    } else if (code >= 95 && code <= 99) {
        icon = 'cloud-lightning';
        bgClass = 'bg-thunder';
        desc = 'Nevihta';
    } else {
        icon = 'cloud-off';
        bgClass = 'bg-cloudy';
        desc = 'Neznano';
    }
    return { icon, bgClass, desc };
};

// --- Smart Wardrobe Logic ---
function getWardrobeAdvice(temp, code, isDay) {
    const isRain = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code);
    const isSnow = [71, 73, 75, 77, 85, 86].includes(code);

    if (temp < 0) return { text: "Mrzlo! Debela bunda, kapa, rokavice.", icon: "snowflake" };
    if (temp < 10 && isRain) return { text: "Hladno in mokro. Topel nepremočljiv plašč.", icon: "umbrella" };
    if (temp < 10 && isSnow) return { text: "Sneži! Debela jakna in zimska obutev.", icon: "snowflake" };
    if (temp < 15) return { text: "Sveže. Topel pulover ali prehodna jakna.", icon: "layers" };
    if (temp >= 15 && temp < 22 && isRain) return { text: "Dežuje. Ne pozabi dežnika in jopice.", icon: "umbrella" };
    if (temp >= 15 && temp < 22) return { text: "Prijetno. Dolgi rokavi ali tanka jakna.", icon: "shirt" };
    if (temp >= 22 && isDay && !isRain) return { text: "Toplo! Kratki rokavi in sončna očala.", icon: "sun" };
    if (temp >= 22 && isRain) return { text: "Poletna ploha. Dežnik in lahka oblačila.", icon: "cloud-rain" };
    return { text: "Toplo. Kratki rokavi in lahkotna oblačila.", icon: "shirt" };
}

// --- Background Fading Logic ---
function triggerBackgroundFade(bgClass) {
    let bgContainer = document.getElementById('bg-container');

    if (!bgContainer) {
        // V primeru da še obstajajo stare plasti od prej, jih počistimo
        const oldBase = document.getElementById('bg-base');
        if (oldBase) oldBase.remove();
        const oldFade = document.getElementById('bg-fade');
        if (oldFade) oldFade.remove();

        bgContainer = document.createElement('div');
        bgContainer.id = 'bg-container';
        bgContainer.className = 'fixed inset-0 w-screen h-screen -z-20 bg-gray-900 overflow-hidden';
        document.body.prepend(bgContainer);

        const initialBg = document.createElement('div');
        initialBg.className = `absolute inset-0 w-full h-full ${bgClass} opacity-100`;
        initialBg.setAttribute('data-bg', bgClass);
        bgContainer.appendChild(initialBg);
    } else {
        const currentTop = bgContainer.lastElementChild;
        if (!currentTop || currentTop.getAttribute('data-bg') !== bgClass) {
            // Dodamo novo plast čez obstoječo
            const newBg = document.createElement('div');
            newBg.className = `absolute inset-0 w-full h-full ${bgClass} transition-opacity duration-[800ms] ease-in-out opacity-0`;
            newBg.setAttribute('data-bg', bgClass);
            bgContainer.appendChild(newBg);

            void newBg.offsetWidth; // Force reflow za animacijo
            newBg.style.opacity = '1';

            // Počistimo prejšnje stare plasti (da preprečimo nabiranje DOM elementov), ko je ta dokončno vidna
            setTimeout(() => {
                if (newBg.parentNode) {
                    let prev = newBg.previousElementSibling;
                    while (prev) {
                        const toRemove = prev;
                        prev = prev.previousElementSibling;
                        toRemove.remove();
                    }
                }
            }, 850);
        }
    }
    // Update body styling but respect mobile scroll properties set in HTML
    document.body.className = `antialiased select-none min-h-screen sm:h-screen overflow-y-auto sm:overflow-hidden transition-colors duration-1000 bg-gray-900 text-white flex items-start sm:items-center justify-center p-2 sm:p-4`;
}

// --- Hobby & Astro Logic ---
function getFrostAlert(daily) {
    for (let i = 0; i < daily.time.length; i++) {
        if (daily.temperature_2m_min[i] <= 0) {
            const date = new Date(daily.time[i]);
            return `Nevarnost: ${date.getDate()}.${date.getMonth() + 1}.`;
        }
    }
    return "Varno (10 dni)";
}

function getDryingIndex(code, humidity, wind) {
    const isRain = [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99, 71, 73, 75, 77, 85, 86].includes(code);
    if (isRain) return "Ni priporočljivo";
    if (humidity < 60 && wind > 15) return "Odlično (Hitro)";
    if (humidity < 75) return "Dobro";
    return "Slabo (Vlažno)";
}

function getHikingStatus(code, wind) {
    const isThunder = [95, 96, 99].includes(code);
    const isHeavyRainSnow = [65, 67, 75, 77, 82, 86].includes(code);

    if (isThunder) return { text: "Nevarno! (Nevihte)", color: "text-red-400", icon: "alert-triangle" };
    if (wind > 50 || isHeavyRainSnow) return { text: "Odsvetovano", color: "text-orange-400", icon: "alert-circle" };
    return { text: "Ugodno", color: "text-green-400", icon: "check-circle" };
}

function getAstroInfo(sunriseIso, sunsetIso, cloudCover, isDay) {
    if (isDay) {
        // Golden hour (evening)
        const sunset = new Date(sunsetIso);
        sunset.setHours(sunset.getHours() - 1);
        const mins = sunset.getMinutes().toString().padStart(2, '0');
        return `Zlata ura: ~${sunset.getHours()}:${mins}`;
    } else {
        // Star visibility based on cloud cover
        if (cloudCover < 20) return "Zvezde: Odlično";
        if (cloudCover < 50) return "Zvezde: Delno vidne";
        return "Zvezde: Zakrite";
    }
}

// Format Date utilities
const getDayName = (dateString, isShort = false) => {
    const date = new Date(dateString);
    const today = new Date();

    if (date.toDateString() === today.toDateString()) return 'Danes';

    // Check tomorrow
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) return 'Jutri';

    return date.toLocaleDateString('sl-SI', { weekday: isShort ? 'short' : 'long' });
};

const formatTemp = (temp) => {
    return Math.round(temp).toString().replace('-', '−') + '°';
};

// Initializer Function
const init = () => {
    showLoading();
    // Drag to scroll functionality for desktop mouse users
    function setupDragScroll() {
        const slider = document.getElementById('forecast-container');
        let isDown = false;
        let startX;
        let scrollLeft;

        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            slider.classList.add('cursor-grabbing');
            slider.classList.remove('snap-x'); // disable snapping while dragging
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });
        slider.addEventListener('mouseleave', () => {
            isDown = false;
            slider.classList.remove('cursor-grabbing');
            slider.classList.add('snap-x');
        });
        slider.addEventListener('mouseup', () => {
            isDown = false;
            slider.classList.remove('cursor-grabbing');
            slider.classList.add('snap-x');
        });
        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2;
            slider.scrollLeft = scrollLeft - walk;
        });
    }
    setupDragScroll();

    // App Initialization
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                let locName = DEFAULT_LOC.name;
                try {
                    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=sl`);
                    if (res.ok) {
                        const data = await res.json();
                        locName = data.city || data.locality || data.principalSubdivision || DEFAULT_LOC.name;
                    }
                } catch (err) {
                    console.warn("Napaka pri pridobivanju imena lokacije:", err);
                }
                fetchWeather(lat, lon, locName);
            },
            (error) => {
                console.warn("Geolokacija zavrnjena ali pa je prišlo do napake. Uporabljam privzeto lokacijo.");
                fetchWeather(DEFAULT_LOC.lat, DEFAULT_LOC.lon, DEFAULT_LOC.name);
            },
            { timeout: 5000 }
        );
    } else {
        fetchWeather(DEFAULT_LOC.lat, DEFAULT_LOC.lon, DEFAULT_LOC.name);
    }
};

// Fetch current, hourly, and 10-day forecast weather from Open-Meteo
const fetchWeather = async (lat, lon, cityName) => {
    showLoading();
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day,cloud_cover&hourly=temperature_2m,weather_code,relative_humidity_2m,cloud_cover,wind_speed_10m,is_day,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=10`;
        const res = await fetch(url);

        if (!res.ok) throw new Error("Napaka pri pridobivanju vremenskih podatkov iz API-ja.");
        const data = await res.json();

        appWeatherState = data;
        currentCityName = cityName;
        renderApp(0);
    } catch (err) {
        showError(err.message);
    }
};

// Geocoding Search handler
const searchLocation = async (query) => {
    if (!query || query.length < 2) {
        searchResults.classList.add('hidden');
        return;
    }
    try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=40&language=sl&format=json`);
        const data = await res.json();

        searchResults.innerHTML = '';
        let hasResults = false;

        if (data.results && data.results.length > 0) {
            // Filter only USA, Europe, and Australia
            const filteredResults = data.results.filter(place => {
                const isUS = place.country_code === 'US';
                const isAU = place.country_code === 'AU';
                const isEurope = place.timezone && place.timezone.startsWith('Europe/');
                const isAustraliaTZ = place.timezone && place.timezone.startsWith('Australia/');
                return isUS || isAU || isEurope || isAustraliaTZ;
            }).slice(0, 5);

            if (filteredResults.length > 0) {
                hasResults = true;
                filteredResults.forEach(place => {
                    const li = document.createElement('li');
                    li.className = 'px-4 py-3 hover:bg-gray-700 cursor-pointer flex flex-col border-b border-gray-600 last:border-none transition-colors text-sm sm:text-base';

                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'font-semibold text-white drop-shadow-sm';
                    nameSpan.textContent = place.name;

                    const adminSpan = document.createElement('span');
                    adminSpan.className = 'text-xs text-gray-300';
                    adminSpan.textContent = `${place.admin1 ? place.admin1 + ', ' : ''}${place.country}`;

                    li.appendChild(nameSpan);
                    li.appendChild(adminSpan);

                    li.onclick = () => {
                        fetchWeather(place.latitude, place.longitude, place.name);
                        searchResults.classList.add('hidden');
                        searchInput.value = '';
                    };
                    searchResults.appendChild(li);
                });
                searchResults.classList.remove('hidden');
            }
        }

        if (!hasResults) {
            searchResults.innerHTML = ''; // Clear previous
            const noResultsLi = document.createElement('li');
            noResultsLi.className = 'px-4 py-3 text-white/70 italic';
            noResultsLi.textContent = 'Ni ujemajočih zadetkov (samo EU/ZDA/AU).';
            searchResults.appendChild(noResultsLi);
            searchResults.classList.remove('hidden');
        }
    } catch (err) {
        console.error("Geocoding Error: ", err);
    }
};

// Listeners
let searchTimeout;
searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => searchLocation(e.target.value), 400); // 400ms debounce
});

searchForm.addEventListener('submit', (e) => e.preventDefault());

document.addEventListener('click', (e) => {
    if (!searchForm.contains(e.target)) {
        searchResults.classList.add('hidden');
    }
});

btnLocation.addEventListener('click', () => {
    searchInput.value = '';
    init();
});

// Scroll Listeners for 10-day forecast
const forecastContainer = document.getElementById('forecast-container');
document.getElementById('scroll-left').addEventListener('click', () => {
    forecastContainer.scrollBy({ left: -200, behavior: 'smooth' });
});

document.getElementById('scroll-right').addEventListener('click', () => {
    forecastContainer.scrollBy({ left: 200, behavior: 'smooth' });
});

// Update the entire UI
const renderApp = (dayIndex = 0) => {
    const data = appWeatherState;
    if (!data) return;

    const current = data.current;
    const daily = data.daily;
    const hourly = data.hourly;

    // Determine the data to show based on if it's today (index 0) or a future day
    let displayTemp, displayDesc, displayIcon, displayPrecip, displayWind, displayHumidity, displayCode, displayCloudCover, bgClass;
    let isDay = true; // Default to day icons for future days

    if (dayIndex === 0) {
        // Today: Use precise current data
        isDay = current.is_day === 1;
        displayCode = current.weather_code;
        displayCloudCover = current.cloud_cover || 0;
        const info = getWeatherInfo(current.weather_code, isDay);
        displayTemp = Math.round(current.temperature_2m);
        displayDesc = info.desc;
        displayIcon = info.icon;
        displayPrecip = current.precipitation;
        displayWind = current.wind_speed_10m;
        displayHumidity = current.relative_humidity_2m;
        bgClass = info.bgClass;
    } else {
        // Future Day: Estimate from daily aggregate
        displayCode = daily.weather_code[dayIndex];
        const info = getWeatherInfo(displayCode, true);
        displayTemp = Math.round((daily.temperature_2m_max[dayIndex] + daily.temperature_2m_min[dayIndex]) / 2); // Average temp
        displayDesc = info.desc;
        displayIcon = info.icon;
        displayPrecip = daily.precipitation_sum[dayIndex];
        displayWind = daily.wind_speed_10m_max[dayIndex];

        // Approximate daily humidity & cloudcover by averaging the 24 hourly values for that day
        const targetDateStr = daily.time[dayIndex];
        const hStartIndex = hourly.time.findIndex(t => t.startsWith(targetDateStr));
        if (hStartIndex !== -1) {
            const hEndIndex = Math.min(hStartIndex + 24, hourly.time.length);
            const hrs = hourly.relative_humidity_2m.slice(hStartIndex, hEndIndex);
            const clds = hourly.cloud_cover.slice(hStartIndex, hEndIndex);
            displayHumidity = Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length);
            displayCloudCover = Math.round(clds.reduce((a, b) => a + b, 0) / clds.length);
        } else {
            displayHumidity = "--";
            displayCloudCover = 0;
        }

        bgClass = info.bgClass;
    }

    // Update Wardrobe Advisor
    const wardrobeInfo = getWardrobeAdvice(displayTemp, displayCode, isDay);
    // Update Wardrobe Advisor Text
    document.getElementById('wardrobe-text').textContent = wardrobeInfo.text;
    document.getElementById('wardrobe-icon').setAttribute('data-lucide', wardrobeInfo.icon);

    // Update Hobby & Astro Widgets Text
    document.getElementById('hobby-frost').textContent = getFrostAlert(daily);
    document.getElementById('hobby-drying').textContent = getDryingIndex(displayCode, displayHumidity !== "--" ? displayHumidity : 60, displayWind);

    const hikingInfo = getHikingStatus(displayCode, displayWind);
    const hikingIndicator = document.getElementById('hobby-hiking');
    hikingIndicator.textContent = hikingInfo.text;
    hikingIndicator.className = `text-[11px] sm:text-xs font-bold drop-shadow leading-tight ${hikingInfo.color}`;
    document.getElementById('hobby-hiking-icon').setAttribute('data-lucide', hikingInfo.icon);

    document.getElementById('astro-info').textContent = getAstroInfo(daily.sunrise[dayIndex], daily.sunset[dayIndex], displayCloudCover, isDay);

    // Additional Details for Modals
    const wardrobeDetail = `<span class="font-bold">Priporočilo za oblačila:</span> ${wardrobeInfo.text} <br><br> Temelji na občuteni temperaturi (${Math.round(current.apparent_temperature || displayTemp)}°C) in trenutnih vremenskih razmerah.`;
    const frostDetail = `<span class="font-bold">Vrtičkarski Alarm:</span> ${getFrostAlert(daily)} <br><br> Opazuje minimalno doseženo temperaturo v naslednjih 10 dneh, da vas pravočasno opozori na prvo slano in s tem na zaščito občutljivih rastlin.`;
    const dryingDetail = `<span class="font-bold">Indeks Sušenja Perila:</span> ${getDryingIndex(displayCode, displayHumidity !== "--" ? displayHumidity : 60, displayWind)} <br><br> Ta indeks izračuna kako hitro se bo sušilo perilo zunaj na podlagi vlažnosti zraka (${displayHumidity}%) in hitrosti vetra (${Math.round(displayWind)} km/h). Med dežjem sušenje ni priporočljivo.`;
    const hikingDetail = `<span class="font-bold">Pohodniški Semafor:</span> ${hikingInfo.text} <br><br> Ocenjuje varnost odhoda v hribe. Preverja ekstremne sunke vetra (${Math.round(displayWind)} km/h), morebitne nevihte in obilne padavine. Vedno preverite še lokalna radarska trčenja stopenjske nevarnosti!`;
    const astroDetail = `<span class="font-bold">Astro Kotiček:</span> ${getAstroInfo(daily.sunrise[dayIndex], daily.sunset[dayIndex], displayCloudCover, isDay)} <br><br> Zlata ura je idealen čas za fotografiranje z mehko svetlobo tik pred sončnim zahodom. Vidljivost zvezd pa je ocenjena na podlagi prekritosti neba z oblaki (${displayCloudCover}%).`;

    // Attach Click Listeners to Cards
    document.getElementById('wardrobe-card').onclick = () => openModal("Pametni Svetovalec", wardrobeDetail, "shirt");
    document.getElementById('card-frost').onclick = () => openModal("Vrtičkarski Alarm", frostDetail, "leaf");
    document.getElementById('card-drying').onclick = () => openModal("Sušenje Perila", dryingDetail, "wind");
    document.getElementById('card-hiking').onclick = () => openModal("V Hribe?", hikingDetail, "mountain");
    document.getElementById('card-astro').onclick = () => openModal("Astro & Zlata Ura", astroDetail, "camera");

    // Trigger Background Fade
    triggerBackgroundFade(bgClass);

    // Main Info Texts
    const localTime = appWeatherState.current.time;
    let timeLabel = "";
    if (localTime) {
        const localDate = new Date(localTime);
        const timeStr = `${localDate.getHours().toString().padStart(2, '0')}:${localDate.getMinutes().toString().padStart(2, '0')}`;
        timeLabel = ` <span class="text-xl sm:text-[22px] font-normal text-white/80 align-baseline ml-1 drop-shadow-sm">${timeStr}</span>`;
    }
    document.getElementById('city-name').innerHTML = `${currentCityName}${timeLabel}`;

    document.getElementById('current-temp').textContent = formatTemp(displayTemp);
    document.getElementById('current-desc').textContent = displayDesc;
    document.getElementById('max-temp').textContent = formatTemp(daily.temperature_2m_max[dayIndex]);
    document.getElementById('min-temp').textContent = formatTemp(daily.temperature_2m_min[dayIndex]);

    // Bottom Details (For future days, some data like instant wind/humidity aren't perfectly accurate via daily without more arrays, but we map closest approximation)
    document.getElementById('current-humidity').textContent = displayHumidity + '%';
    document.getElementById('current-wind').textContent = Math.round(displayWind) + ' km/h';
    document.getElementById('current-uv').textContent = daily.uv_index_max[dayIndex] !== null ? daily.uv_index_max[dayIndex].toFixed(1) : '--';
    document.getElementById('current-precip').textContent = displayPrecip.toFixed(1) + ' mm';

    // Sunrise / Sunset
    const formatTime = (isoString) => {
        const d = new Date(isoString);
        return d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
    };

    document.getElementById('current-sunrise').textContent = daily.sunrise && daily.sunrise[dayIndex] ? formatTime(daily.sunrise[dayIndex]) : '--:--';
    document.getElementById('current-sunset').textContent = daily.sunset && daily.sunset[dayIndex] ? formatTime(daily.sunset[dayIndex]) : '--:--';

    // Update Big Main Icon
    const iconContainer = document.getElementById('current-icon-container');
    const isBrightIcon = (isDay && (displayIcon === 'sun' || displayIcon === 'cloud-sun'));
    iconContainer.innerHTML = `<i data-lucide="${displayIcon}" class="w-16 h-16 sm:w-20 sm:h-20 ${isBrightIcon ? 'text-yellow-400' : 'text-white'} drop-shadow-2xl"></i>`;

    renderChart(hourly, dayIndex, daily.time[dayIndex]);
    renderForecast(daily, dayIndex);

    // Re-initialize dynamic Lucide icons
    lucide.createIcons();
    showContent();
};

// Render 24-Hour Fluctuation Chart with Chart.js
const renderChart = (hourly, dayIndex, targetDateStr) => {
    const ctx = document.getElementById('hourly-chart').getContext('2d');

    // Za vsak dan želimo poiskati indeks, ki se prične opolnoči tarčnega dneva
    let startIndex = hourly.time.findIndex(t => t.startsWith(targetDateStr));
    if (startIndex === -1) startIndex = 0; // fallback error handled

    let labelPrefix = dayIndex === 0 ? "Današnji potek" : "Potek dneva";

    // Select strictly 24 slices (or fewer if at the end of array)
    const sliceEnd = Math.min(startIndex + 24, hourly.time.length);
    const times = hourly.time.slice(startIndex, sliceEnd).map(t => {
        const d = new Date(t);
        return d.getHours() + ':00';
    });
    const temps = hourly.temperature_2m.slice(startIndex, sliceEnd).map(t => Math.round(t));

    if (chartInstance) {
        chartInstance.destroy();
    }

    Chart.defaults.color = 'rgba(255, 255, 255, 0.9)';
    Chart.defaults.font.family = "'Inter', sans-serif";

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: times,
            datasets: [{
                label: 'Temperatura (°C)',
                data: temps,
                borderColor: 'rgba(255, 255, 255, 1)',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 3,
                pointBackgroundColor: 'rgba(255, 255, 255, 1)',
                pointBorderColor: 'transparent',
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.4,
                fill: true
            }]
        },
        plugins: [{
            id: 'verticalLineAndLabels',
            afterDraw: chart => {
                const ctx = chart.ctx;
                ctx.save();

                const meta = chart.getDatasetMeta(0);

                // 1. Prikaz temperature (številk) neposredno nad vsako točko
                // Prikaže se samo na širših napravah (500px in več)
                if (window.innerWidth >= 500 && meta && meta.data) {
                    ctx.font = "bold 11px Inter, sans-serif";
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';

                    meta.data.forEach((point, index) => {
                        const temp = chart.data.datasets[0].data[index];
                        const x = point.x;
                        const y = point.y;
                        ctx.fillText(temp + '°', x, y - 8);
                    });
                }

                // 2. Narisanje navpične črte za časovni stroj
                if (chart.options.plugins.verticalLine && chart.options.plugins.verticalLine.activeIndex !== undefined) {
                    const activeIndex = chart.options.plugins.verticalLine.activeIndex;
                    if (meta && meta.data && activeIndex >= 0 && activeIndex < meta.data.length) {
                        const x = meta.data[activeIndex].x;
                        const topY = chart.scales.y.top;
                        const bottomY = chart.scales.y.bottom;
                        const y = meta.data[activeIndex].y;

                        // Narisanje črtkane črte
                        ctx.beginPath();
                        ctx.moveTo(x, topY);
                        ctx.lineTo(x, bottomY);
                        ctx.lineWidth = 1.5;
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                        ctx.setLineDash([4, 4]);
                        ctx.stroke();

                        // Poudarjena pika
                        ctx.beginPath();
                        ctx.arc(x, y, 5, 0, 2 * Math.PI);
                        ctx.fillStyle = '#fff';
                        ctx.fill();
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = '#3b82f6';
                        ctx.stroke();
                    }
                }

                // 3. Narisanje TRENUTNE REALNE URE (fiksna črta za realni čas, če je na grafu danes)
                if (chart.options.plugins.realTimeLine && chart.options.plugins.realTimeLine.realIndex !== undefined) {
                    const realIndex = chart.options.plugins.realTimeLine.realIndex;
                    if (meta && meta.data && realIndex >= 0 && realIndex < meta.data.length) {
                        const x = meta.data[realIndex].x;
                        const topY = chart.scales.y.top;
                        const bottomY = chart.scales.y.bottom;

                        // Narisanje suptilne neprekinjene črte za realni čas
                        ctx.beginPath();
                        ctx.moveTo(x, topY);
                        ctx.lineTo(x, bottomY);
                        ctx.lineWidth = 1.5;
                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'; // Bolj suptilna, nevsiljiva barva (polprosojna bela)
                        ctx.setLineDash([]);
                        ctx.stroke();
                    }
                }

                ctx.restore();
            }
        }],
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                verticalLine: { activeIndex: 0 },
                realTimeLine: { realIndex: undefined },
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    displayColors: false,
                    padding: 10,
                    callbacks: {
                        label: function (context) {
                            return context.parsed.y.toString().replace('-', '−') + ' °C';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false, drawBorder: false },
                    ticks: { maxTicksLimit: 8, color: 'rgba(255,255,255,0.8)' }
                },
                y: {
                    suggestedMax: Math.max(...temps) + 1,
                    suggestedMin: Math.min(...temps) - 1,
                    grid: { color: 'rgba(255,255,255,0.2)', drawBorder: false },
                    ticks: { maxTicksLimit: 6, callback: (value) => value.toString().replace('-', '−') + '°', color: 'rgba(255,255,255,0.8)' }
                }
            }
        }
    });

    // Če smo na prvem dnevu (Danes), preverimo katera ura je dejansko sedaj in jo nastavimo v graf
    if (dayIndex === 0) {
        const nowHourStr = new Date().getHours() + ':00';
        const nowIndex = chartInstance.data.labels.findIndex(label => label === nowHourStr);
        if (nowIndex !== -1) {
            chartInstance.options.plugins.realTimeLine.realIndex = nowIndex;
            chartInstance.update('none');
        }
    }
};

// Render 10-Day Forecast horizontally
const renderForecast = (daily, activeDayIndex = 0) => {
    const container = document.getElementById('forecast-container');
    container.innerHTML = '';

    // Loop through 10 days
    for (let i = 0; i < daily.time.length; i++) {
        const dateStr = daily.time[i];
        const minDateTemp = formatTemp(daily.temperature_2m_min[i]);
        const maxDateTemp = formatTemp(daily.temperature_2m_max[i]);

        // Always pass `true` for isDay so that daily summary icons are shown as daytime variants
        const info = getWeatherInfo(daily.weather_code[i], true);

        const dayName = getDayName(dateStr, true);
        const isActive = i === activeDayIndex;

        const card = document.createElement('div');
        // Smoother scaling and better active styling
        const baseClasses = 'glass-card min-w-[90px] sm:min-w-[110px] shrink-0 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center snap-start transition-all duration-300 transform cursor-pointer ';
        // Made active state much cleaner: no thick border all around, no huge shadow.
        const activeClasses = isActive
            ? 'bg-white/20 shadow-md border-b-[3px] border-b-white/60 border-t border-t-white/10 border-l border-l-white/10 border-r border-r-white/10 scale-100'
            : 'border border-transparent hover:border-white/20 hover:bg-white/10 hover:scale-[1.02]';

        card.className = baseClasses + activeClasses;

        card.innerHTML = `
            <span class="text-xs sm:text-sm font-semibold text-white/90 mb-2 capitalize drop-shadow-sm">${dayName}</span>
            <i data-lucide="${info.icon}" class="w-8 h-8 sm:w-10 sm:h-10 ${info.icon.includes('sun') ? 'text-yellow-400' : 'text-white'} mb-2 drop-shadow-md"></i>
            <div class="flex gap-2 text-sm sm:text-base font-bold">
                <span class="drop-shadow-sm">${maxDateTemp}</span>
                <span class="text-white/60 drop-shadow-sm">${minDateTemp}</span>
            </div>
        `;

        // Add click listener
        card.addEventListener('click', () => {
            document.getElementById('time-slider').value = 0; // Reset slider
            document.getElementById('time-travel-label').textContent = 'Prestavite drsnik';
            renderApp(i);
        });

        container.appendChild(card);
    }

    // Initialize Time-Travel Slider constrained to 24h of the active day
    setupTimeTravelSlider(activeDayIndex);

    lucide.createIcons();
};

// --- Modal Logic ---
const modal = document.getElementById('info-modal');
const modalContent = document.getElementById('info-modal-content');
const modalTitle = document.getElementById('modal-title');
const modalDesc = document.getElementById('modal-desc');
const modalIcon = document.getElementById('modal-icon');
const closeModalBtn = document.getElementById('close-modal');

function openModal(title, desc, iconName) {
    modalTitle.textContent = title;
    modalDesc.innerHTML = desc;
    modalIcon.setAttribute('data-lucide', iconName);
    lucide.createIcons();

    modal.classList.remove('opacity-0', 'pointer-events-none');
    modalContent.classList.remove('scale-95');
    modalContent.classList.add('scale-100');
}

function closeModal() {
    modal.classList.add('opacity-0', 'pointer-events-none');
    modalContent.classList.remove('scale-100');
    modalContent.classList.add('scale-95');
}

closeModalBtn.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

// --- Time Travel Slider Logic ---
function setupTimeTravelSlider(dayIndex) {
    const slider = document.getElementById('time-slider');
    const infoContainer = document.getElementById('time-travel-info');
    if (infoContainer) {
        infoContainer.classList.add('hidden');
        infoContainer.classList.remove('flex');
    }

    // Remove old listeners to prevent stacking
    const newSlider = slider.cloneNode(true);
    slider.parentNode.replaceChild(newSlider, slider);

    const daily = appWeatherState.daily;
    const targetDateStr = daily.time[dayIndex];
    let baseHourIndex = appWeatherState.hourly.time.findIndex(t => t.startsWith(targetDateStr));
    if (baseHourIndex === -1) baseHourIndex = 0;

    // If viewing today, default slider to current hour instead of midnight
    if (dayIndex === 0) {
        const nowIso = appWeatherState.current.time || new Date().toISOString().slice(0, 13) + ":00";
        let currentHourIndex = appWeatherState.hourly.time.findIndex(t => t.startsWith(nowIso.slice(0, 13)));
        if (currentHourIndex !== -1 && currentHourIndex >= baseHourIndex) {
            newSlider.value = currentHourIndex - baseHourIndex;
            const hour = new Date(appWeatherState.hourly.time[currentHourIndex]).getHours().toString().padStart(2, '0');
            document.getElementById('time-travel-label').textContent = `čas: Danes, ${hour}:00`;
        } else {
            document.getElementById('time-travel-label').textContent = 'Prestavite drsnik';
            newSlider.value = 0;
        }
    } else {
        newSlider.value = 12; // Default to mid-day for future days
        document.getElementById('time-travel-label').textContent = 'Prestavite drsnik';
    }

    // Nastavimo začetno pozicijo črte na grafu
    if (chartInstance && chartInstance.options.plugins.verticalLine) {
        chartInstance.options.plugins.verticalLine.activeIndex = parseInt(newSlider.value, 10);
        chartInstance.update('none');
    }

    newSlider.addEventListener('input', (e) => {
        const offset = parseInt(e.target.value, 10);
        applyTimeTravelTarget(baseHourIndex + offset);
    });
}

function applyTimeTravelTarget(targetIndex) {
    const hourly = appWeatherState.hourly;
    if (!hourly || targetIndex >= hourly.time.length) return;

    const timeIso = hourly.time[targetIndex];
    const temp = hourly.temperature_2m[targetIndex];
    const precip = hourly.precipitation ? hourly.precipitation[targetIndex] : 0;
    const code = hourly.weather_code[targetIndex];
    const isDay = hourly.is_day[targetIndex] === 1;

    const info = getWeatherInfo(code, isDay);

    // Update label
    const dateObj = new Date(timeIso);
    const dayName = getDayName(timeIso, true);
    const timeStr = `${dateObj.getHours().toString().padStart(2, '0')}:00`;
    document.getElementById('time-travel-label').textContent = `čas: ${dayName}, ${timeStr}`;

    // Update vertical line on chart
    if (chartInstance && chartInstance.options.plugins.verticalLine) {
        const slider = document.getElementById('time-slider');
        chartInstance.options.plugins.verticalLine.activeIndex = parseInt(slider.value, 10);
        chartInstance.update('none');
    }

    // Show isolated time travel info
    const infoContainer = document.getElementById('time-travel-info');
    if (infoContainer) {
        infoContainer.classList.remove('hidden');
        infoContainer.classList.add('flex');

        document.getElementById('time-travel-temp').textContent = formatTemp(temp);
        document.getElementById('time-travel-precip').textContent = precip.toFixed(1) + ' mm';

        const iconEl = document.getElementById('time-travel-icon');
        iconEl.setAttribute('data-lucide', info.icon);
        const isBrightIcon = (isDay && (info.icon === 'sun' || info.icon === 'cloud-sun'));
        iconEl.className = `w-4 h-4 sm:w-5 sm:h-5 ${isBrightIcon ? 'text-yellow-400' : 'text-white'}`;

        lucide.createIcons();
    }

    // Change background smoothly
    triggerBackgroundFade(info.bgClass);
}

// UI State Toggles
const showLoading = () => {
    loadingState.classList.remove('hidden');
    weatherContent.classList.add('hidden');
    weatherContent.classList.remove('flex');
    errorState.classList.add('hidden');
};

const showContent = () => {
    loadingState.classList.add('hidden');
    weatherContent.classList.remove('hidden');
    weatherContent.classList.add('flex');
    errorState.classList.add('hidden');
};

const showError = (msg) => {
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorMessage.textContent = msg;
};

// Start application
init();
