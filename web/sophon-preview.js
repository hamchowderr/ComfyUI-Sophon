import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const SOPHON_NODES = new Set([
    "SophonDownloadOutput",
    "SophonEncodeVideo",
]);

function buildViewUrl(entry) {
    const p = new URLSearchParams();
    p.set("filename", entry.filename);
    if (entry.subfolder) p.set("subfolder", entry.subfolder);
    p.set("type", entry.type || "output");
    return api.apiURL(`/view?${p.toString()}&t=${Date.now()}`);
}

function ensureVideoDom(node) {
    if (node._sophonDom) return node._sophonDom;

    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.alignItems = "center";
    container.style.padding = "4px";
    container.style.boxSizing = "border-box";

    const video = document.createElement("video");
    video.controls = true;
    video.playsInline = true;
    video.muted = true;
    video.loop = true;
    video.preload = "metadata";
    video.style.width = "100%";
    video.style.height = "auto";
    video.style.maxWidth = "100%";
    video.style.display = "block";
    video.style.background = "#000";
    container.appendChild(video);

    const stats = document.createElement("pre");
    stats.style.margin = "4px 0 0 0";
    stats.style.padding = "4px 6px";
    stats.style.fontFamily = "monospace";
    stats.style.fontSize = "11px";
    stats.style.lineHeight = "1.35";
    stats.style.whiteSpace = "pre-wrap";
    stats.style.color = "#ddd";
    stats.style.background = "rgba(0,0,0,0.25)";
    stats.style.borderRadius = "3px";
    stats.style.width = "100%";
    stats.style.boxSizing = "border-box";
    container.appendChild(stats);

    const widget = node.addDOMWidget("sophon_preview", "div", container, {
        serialize: false,
        hideOnZoom: false,
    });
    widget.computeSize = function (width) {
        const aspect = node._sophonAspect || 16 / 9;
        const inner = Math.max(64, width - 16);
        const videoH = Math.round(inner / aspect);
        const statsH = stats.textContent ? Math.max(24, stats.scrollHeight || 60) : 0;
        return [width, videoH + statsH + 16];
    };

    node._sophonDom = { container, video, stats, widget };
    return node._sophonDom;
}

function applyMessage(node, message) {
    const entries = message.sophon_video || [];
    const statsLines = message.text || [];
    if (!entries.length && !statsLines.length) return;

    const dom = ensureVideoDom(node);

    if (entries.length) {
        const src = buildViewUrl(entries[0]);
        dom.video.src = src;
        dom.video.addEventListener(
            "loadedmetadata",
            () => {
                if (dom.video.videoWidth && dom.video.videoHeight) {
                    node._sophonAspect = dom.video.videoWidth / dom.video.videoHeight;
                    node.setSize(node.computeSize());
                    node.setDirtyCanvas(true, true);
                }
            },
            { once: true }
        );
    }

    dom.stats.textContent = statsLines.join("\n");
    node.setSize(node.computeSize());
    node.setDirtyCanvas(true, true);
}

app.registerExtension({
    name: "sophon.preview",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!SOPHON_NODES.has(nodeData?.name)) return;

        const origOnExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            origOnExecuted?.apply(this, arguments);
            if (message) applyMessage(this, message);
        };
    },
});
