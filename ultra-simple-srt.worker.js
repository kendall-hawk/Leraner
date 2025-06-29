// js/workers/ultra-simple-srt.worker.js - 改进版
// 替代 200 行的复杂SRT Worker，保留核心功能并添加文本提取

self.onmessage = function(e) {
    try {
        const { srtText } = e.data;
        const result = parseSRT(srtText);
        self.postMessage({ success: true, data: result });
    } catch (error) {
        self.postMessage({ success: false, error: error.message });
    }
};

function parseSRT(srtText) {
    const blocks = srtText.replace(/\r\n/g, '\n').trim().split('\n\n');
    const cues = [];
    
    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length >= 3 && lines[1] && lines[1].includes('-->')) {
            const [start, end] = lines[1].split('-->');
            
            // 提取字幕文本（第3行及之后的所有行）
            const text = lines.slice(2).join('\n').trim();
            
            cues.push({
                id: lines[0].trim(),
                startTime: timeToSeconds(start.trim()),
                endTime: timeToSeconds(end.trim()),
                text: text || '', // 添加文本内容
                duration: 0 // 将在后面计算
            });
        }
    }
    
    // 计算duration并添加额外信息
    for (const cue of cues) {
        cue.duration = Number((cue.endTime - cue.startTime).toFixed(3));
    }
    
    return cues;
}

function timeToSeconds(timeString) {
    try {
        const parts = timeString.split(':');
        if (parts.length !== 3) {
            console.error('Invalid time format:', timeString);
            return 0;
        }
        
        const [hours, minutes, secondsPart] = parts;
        const [seconds, milliseconds] = secondsPart.split(',');
        
        const h = parseInt(hours, 10) || 0;
        const m = parseInt(minutes, 10) || 0;
        const s = parseInt(seconds, 10) || 0;
        const ms = parseInt(milliseconds, 10) || 0;
        
        return h * 3600 + m * 60 + s + ms / 1000;
    } catch (error) {
        console.error('Time parsing error:', timeString, error);
        return 0;
    }
}