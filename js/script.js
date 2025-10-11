let currentChartInstances = {};
let nextId = 5;
let projectData = [];
const LOCAL_STORAGE_KEY = "project_infographic_local_data";

const RAW_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vRGii2rWgPxTiOdSN-WunnE2LVE0TVzvRP6Q_5xK0ikcw1fXn5vvJ1cKLvyd-COpQ7ZJFnmQNWwEfuQ/pub?output=csv";

const CORS_PROXY = "https://api.allorigins.win/get?url=";
const SHEET_URL = CORS_PROXY + encodeURIComponent(RAW_SHEET_URL);

const DEFAULT_PROJECT_DATA = [
  {
    id: 1,
    name: "Reabilitare Strada Principală A",
    start: "2025-09-20",
    end: "2025-11-05",
    status: "Active",
    source: "sheet",
  },
  {
    id: 2,
    name: "Finalizare Amenajare Parcul Central",
    start: "2025-09-15",
    end: "2025-10-01",
    status: "Completed",
    source: "sheet",
  },
  {
    id: 3,
    name: "Instalare Sistem Supraveghere Cartier Nou",
    start: "2025-10-01",
    end: null,
    status: "On Hold",
    source: "sheet",
  },
  {
    id: 4,
    name: "Planificare Bugetară Anul Viitor",
    start: "2025-09-25",
    end: null,
    status: "Active",
    source: "sheet",
  },
];

const TODAY_AS_OF = new Date("2025-10-10T12:00:00Z");

const saveLocalData = () => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projectData));
};

const loadLocalData = () => {
  try {
    const localDataString = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localDataString) {
      return JSON.parse(localDataString);
    }
  } catch (e) {
    console.error("Failed to load local storage data:", e);
  }
  return null;
};

const exportToCSV = () => {
  if (projectData.length === 0) {
    console.warn("No data to export.");
    return;
  }

  const headers = ["id", "name", "start", "end", "status"];

  const rows = projectData.map((p) => [
    p.id,
    `"${p.name.replace(/"/g, '""')}"`,
    p.start,
    p.end || "",
    p.status,
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");

  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);

  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  link.setAttribute("download", `Project_Export_${date}.csv`);

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  console.log("CSV Exported successfully.");
};

const fetchSheetData = async () => {
  let sheetData = [];
  let maxIdFromSheet = 0;

  try {
    const response = await fetch(SHEET_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    let csvText = "";
    let rawResponse = await response.text();

    try {
      const json = JSON.parse(rawResponse);
      if (json.contents) {
        csvText = json.contents;
        console.log(
          "Date preluate cu succes prin proxy (wrapper JSON detectat)."
        );
      } else {
        console.warn(
          "Proxy a returnat JSON, dar fără câmpul 'contents'. Se încearcă procesarea ca text brut."
        );
        csvText = rawResponse;
      }
    } catch (e) {
      console.log("Date preluate și tratate ca text CSV brut.");
      csvText = rawResponse;
    }

    console.log(
      "Raw CSV Text Preview (First 500 chars):",
      csvText.substring(0, 500)
    );

    const base64Data = csvText.split(",")[1];
    const decoded = decodeURIComponent(escape(atob(base64Data)));

    const lines = decoded
      .split(/\r?\n|\r/)
      .filter((line) => line.trim() !== "");

    console.log(lines);

    if (lines.length >= 1) {
      const headers = lines[0]
        .toLowerCase()
        .trim()
        .split(",")
        .map((h) => h.trim().replace(/"/g, ""));

      const headerIndices = {
        id: headers.indexOf("id"),
        name: headers.indexOf("name"),
        start: headers.indexOf("start"),
        end: headers.indexOf("end"),
        status: headers.indexOf("status"),
      };

      console.log(headers);

      const requiredIndices = [
        headerIndices["id"],
        headerIndices["name"],
        headerIndices["start"],
        headerIndices["status"],
      ];

      if (requiredIndices.some((i) => i < 0)) {
        console.error(
          "CSV-ul lipsește unul sau mai multe antete obligatorii (id, name, start, status)."
        );
        return [];
      }

      for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split(",");

        if (fields.length >= headerIndices["status"] + 1) {
          const getCleanValue = (index) => {
            if (fields[index] === undefined || fields[index] === null)
              return "";
            return fields[index]
              .trim()
              .replace(/^"|"$/g, "")
              .replace(/""/g, '"');
          };

          const projectId = parseInt(getCleanValue(headerIndices["id"]));
          const projectName = getCleanValue(headerIndices["name"]);
          const startDate = getCleanValue(headerIndices["start"]);
          const endDateRaw = getCleanValue(headerIndices["end"]);
          const projectStatus = getCleanValue(headerIndices["status"]);

          const endDate =
            endDateRaw === "" || endDateRaw.toUpperCase() === "NULL"
              ? null
              : endDateRaw;

          if (!isNaN(projectId) && projectName !== "" && startDate !== "") {
            sheetData.push({
              id: projectId,
              name: projectName,
              start: startDate,
              end: endDate,
              status: projectStatus,
              source: "sheet",
            });
            maxIdFromSheet = Math.max(maxIdFromSheet, projectId);
          }
        }
      }
      console.table(sheetData);
    }
  } catch (error) {
    console.error(
      `Eroare la preluarea sau parsarea datelor (verificați URL-ul proxy/HTTP).\n- 1. URL-ul Google Sheet (${RAW_SHEET_URL}) nu este corect sau nu este publicat ca CSV.\n- 2. Serviciul proxy (${CORS_PROXY}) a eșuat sau a returnat date nevalide.`,
      error
    );
    sheetData = [];
    maxIdFromSheet = 0;
  }

  const localData = loadLocalData();

  if (localData && localData.length > 0) {
    projectData = localData;
    console.log(`Încărcat ${localData.length} proiecte din stocarea locală.`);
  }
  if (sheetData.length > 0) {
    projectData = sheetData;
    console.log(
      `Se începe cu ${projectData.length} proiecte încărcate din foaia Google.`
    );
    saveLocalData();
  } else {
    projectData = DEFAULT_PROJECT_DATA;
    console.log(
      `Datele din foaia Google și stocarea locală sunt goale. Se folosesc datele implicite (${projectData.length} proiecte).`
    );
    saveLocalData();
  }

  nextId =
    projectData.length > 0 ? Math.max(...projectData.map((p) => p.id)) + 1 : 1;
};

const dateDiffInDays = (a, b) => {
  const _MS_PER_DAY = 1000 * 60 * 60 * 24;
  const utc1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utc2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((utc2 - utc1) / _MS_PER_DAY);
};

const formatDate = (date) => {
  return date.toLocaleDateString("ro-RO", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const updateDynamicDates = () => {
  const date = TODAY_AS_OF;
  const currentYear = date.getFullYear();
  const currentQuarter = Math.ceil((date.getMonth() + 1) / 3);
  const formattedDate = formatDate(date);

  document.getElementById(
    "mainTitle"
  ).textContent = `Portofoliu de Proiecte Municipale Beiuş: ${currentYear}`;
  document.getElementById(
    "subtitle"
  ).textContent = `O prezentare infografică a cronologiilor, duratelor și statusurilor curente ale proiectelor, date actualizate la ${formattedDate}.`;
  document.getElementById(
    "footerDate"
  ).textContent = `Date actualizate la ${formattedDate}.`;
};

const wrapLabel = (label) => {
  const maxLength = 16;
  if (typeof label !== "string" || label.length <= maxLength) {
    return label;
  }
  const words = label.split(" ");
  const lines = [];
  let currentLine = "";
  for (const word of words) {
    if ((currentLine + " " + word).trim().length > maxLength) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = (currentLine + " " + word).trim();
    }
  }
  if (currentLine) {
    lines.push(currentLine.trim());
  }
  return lines;
};

const tooltipTitleCallback = (tooltipItems) => {
  const item = tooltipItems[0];
  let label = item.chart.data.labels[item.dataIndex];
  if (Array.isArray(label)) {
    return label.join(" ");
  } else {
    return label;
  }
};

const colorScale = ["#FCD34D", "#F97316", "#DC2626", "#991B1B"];

const getDurationColor = (duration, maxDuration) => {
  if (maxDuration <= 0) return "#007BFF";

  const normalized = duration / maxDuration;

  const index = Math.min(
    colorScale.length - 1,
    Math.floor(normalized * colorScale.length)
  );

  return colorScale[index];
};

const getProjectColor = (p, maxActiveDuration) => {
  if (p.status === "Completed") return "#10B981";
  if (p.status === "On Hold") return "#2E4057";
  if (p.status === "Active") {
    return getDurationColor(p.duration, maxActiveDuration);
  }
  return "#007BFF";
};

const sharedChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      callbacks: {
        title: tooltipTitleCallback,
        label: (context) => {
          let label = context.dataset.label || "";
          const value = context.parsed.x || context.parsed.y || context.parsed;

          if (context.chart.config.type === "doughnut") {
            const statusMap = {
              Active: "Activ",
              Completed: "Finalizat",
              "On Hold": "În Așteptare",
            };
            return `${statusMap[context.label] || context.label}: ${value}`;
          }

          if (
            context.chart.config.type === "bar" &&
            context.datasetIndex === 1
          ) {
            label = "Durată";
            return `${label}: ${value} Zile`;
          }

          return `${label}: ${value}`;
        },
      },
    },
    legend: {
      labels: {
        font: {
          family: "Inter",
        },
        generateLabels: (chart) => {
          const originalLabels =
            Chart.defaults.plugins.legend.labels.generateLabels(chart);
          const statusMap = {
            Active: "Activ",
            Completed: "Finalizat",
            "On Hold": "În Așteptare",
          };
          const colorMap = {
            Active: "#54A0FF",
            Completed: "#00D2D3",
            "On Hold": "#2E4057",
          };
          return originalLabels.map((label) => ({
            ...label,
            text: statusMap[label.text] || label.text,
            fillStyle: colorMap[label.text] || label.fillStyle,
          }));
        },
      },
    },
  },
  scales: {
    x: {
      ticks: { font: { family: "Inter" } },
      grid: { display: false },
    },
    y: {
      ticks: { font: { family: "Inter" } },
      grid: { color: "#e2e8f0" },
    },
  },
};

const listProjects = () => {
  const listContainer = document.getElementById("projectList");
  listContainer.innerHTML = "";

  if (projectData.length === 0) {
    listContainer.innerHTML =
      '<p class="text-center text-slate-500 py-4">Nu sunt urmărite proiecte în prezent.</p>';
    return;
  }

  projectData.forEach((p) => {
    const item = document.createElement("div");
    const sourceBadge =
      p.source === "sheet"
        ? '<span class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded text-indigo-600 bg-indigo-200 uppercase last:mr-0 mr-1">Sheet</span>'
        : '<span class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded text-yellow-600 bg-yellow-200 uppercase last:mr-0 mr-1">Local</span>';

    item.className =
      "flex justify-between items-center bg-slate-50 p-3 rounded-md border border-slate-200";
    item.innerHTML = `
                    <span class="truncate text-slate-800 font-medium">${p.name}</span>
                    <div class="flex items-center space-x-2">
                        ${sourceBadge}
                        <button onclick="removeProject(${p.id})" class="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-100 transition duration-150">
                            &#x1F5D1;
                        </button>
                    </div>
                `;
    listContainer.appendChild(item);
  });
};

const addProject = () => {
  const name = document.getElementById("projectName").value.trim();
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value || null;
  const status = document.getElementById("projectStatus").value;

  if (!name || !start) {
    console.error("Numele Proiectului și Data de Început sunt obligatorii.");
    return;
  }

  const newProject = {
    id: nextId++,
    name,
    start,
    end,
    status,
    source: "local", // Marcat ca adăugat local
  };

  projectData.push(newProject);

  document.getElementById("projectName").value = "";
  document.getElementById("startDate").value = "";
  document.getElementById("endDate").value = "";
  document.getElementById("projectStatus").value = "Active";

  saveLocalData();
  renderCharts();
};

const removeProject = (id) => {
  projectData = projectData.filter((p) => p.id !== id);
  saveLocalData();
  renderCharts();
};

const renderCharts = () => {
  Object.values(currentChartInstances).forEach((chart) => {
    if (chart && typeof chart.destroy === "function") {
      chart.destroy();
    }
  });
  currentChartInstances = {};

  document.getElementById("totalProjects").textContent = projectData.length;

  if (projectData.length === 0) {
    listProjects();
    return;
  }

  const statusMapRo = {
    Active: "Activ",
    Completed: "Finalizat",
    "On Hold": "În Așteptare",
  };

  const processedData = projectData.map((p) => {
    const startDate = new Date(p.start + "T12:00:00Z");
    const endDate = p.end ? new Date(p.end + "T12:00:00Z") : TODAY_AS_OF;
    const duration = dateDiffInDays(startDate, endDate) + 1;
    return {
      ...p,
      startDate,
      endDate,
      duration,
      statusRo: statusMapRo[p.status],
    };
  });

  const activeProjects = processedData.filter((p) => p.status === "Active");
  const maxActiveDuration = activeProjects.reduce(
    (max, p) => Math.max(max, p.duration),
    0
  );

  const statusCounts = processedData.reduce((acc, p) => {
    acc[p.statusRo] = (acc[p.statusRo] || 0) + 1;
    return acc;
  }, {});

  currentChartInstances.donut = new Chart(
    document.getElementById("statusDonutChart"),
    {
      type: "doughnut",
      data: {
        labels: Object.keys(statusCounts),
        datasets: [
          {
            label: "Status Proiect",
            data: Object.values(statusCounts),
            backgroundColor: ["#54A0FF", "#00D2D3", "#2E4057"],
            borderColor: "#FFFFFF",
            borderWidth: 2,
          },
        ],
      },
      options: { ...sharedChartOptions, scales: {} },
    }
  );

  const sortedByDuration = [...processedData].sort(
    (a, b) => a.duration - b.duration
  );

  currentChartInstances.bar = new Chart(
    document.getElementById("durationBarChart"),
    {
      type: "bar",
      data: {
        labels: sortedByDuration.map((p) => wrapLabel(p.name)),
        datasets: [
          {
            label: "Zile Deschise",
            data: sortedByDuration.map((p) => p.duration),
            backgroundColor: sortedByDuration.map((p) =>
              getProjectColor(p, maxActiveDuration)
            ),
            borderRadius: 4,
          },
        ],
      },
      options: {
        ...sharedChartOptions,
        indexAxis: "y",
        scales: {
          x: {
            title: { display: true, text: "Total Zile" },
            grid: { display: true, color: "#e2e8f0" },
            ticks: { font: { family: "Inter" } },
          },
          y: {
            grid: { display: false },
            ticks: { font: { family: "Inter" } },
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              title: tooltipTitleCallback,
              label: (context) => {
                return `Zile Deschise: ${context.parsed.x}`;
              },
            },
          },
        },
      },
    }
  );

  const earliestStartDate = new Date(
    Math.min(...processedData.map((p) => p.startDate))
  );
  const ganttData = processedData.map((p) => {
    const offset = dateDiffInDays(earliestStartDate, p.startDate);
    return { ...p, offset };
  });

  currentChartInstances.gantt = new Chart(
    document.getElementById("ganttChart"),
    {
      type: "bar",
      data: {
        labels: ganttData.map((p) => wrapLabel(p.name)),
        datasets: [
          {
            label: "Zile până la Începere",
            data: ganttData.map((p) => p.offset),
            backgroundColor: "transparent",
          },
          {
            label: "Durată",
            data: ganttData.map((p) => p.duration),
            backgroundColor: ganttData.map((p) =>
              getProjectColor(p, maxActiveDuration)
            ),
            borderRadius: 2,
          },
        ],
      },
      options: {
        ...sharedChartOptions,
        indexAxis: "y",
        scales: {
          x: {
            stacked: true,
            min: 0,
            title: {
              display: true,
              text: "Zile de la Începerea Primului Proiect",
            },
            grid: { display: true, color: "#e2e8f0" },
            ticks: { font: { family: "Inter" } },
          },
          y: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { family: "Inter" } },
          },
        },
        plugins: {
          ...sharedChartOptions.plugins,
          legend: {
            display: false,
          },
        },
      },
    }
  );

  listProjects();
};

window.onload = async () => {
  await fetchSheetData();
  updateDynamicDates();
  renderCharts();
};
window.addProject = addProject;
window.removeProject = removeProject;
window.exportToCSV = exportToCSV;
