export interface SubtitleCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export const parseSubtitle = (content: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];
  
  // Detect format
  const isVTT = content.trim().startsWith('WEBVTT');
  
  // Normalize line endings
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  
  let i = 0;
  if (isVTT) {
    // Skip header
    while (i < lines.length && lines[i].trim() !== '') i++;
  }

  while (i < lines.length) {
    let line = lines[i].trim();
    
    // Skip empty lines or indices (for SRT)
    if (!line || /^\d+$/.test(line)) {
      i++;
      continue;
    }

    // Check for timing line
    // SRT: 00:00:20,000 --> 00:00:24,400
    // VTT: 00:00:20.000 --> 00:00:24.400
    if (line.includes('-->')) {
      const parts = line.split('-->');
      if (parts.length === 2) {
        const start = parseTime(parts[0].trim());
        const end = parseTime(parts[1].trim());
        
        let text = '';
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          text += lines[i].trim() + ' ';
          i++;
        }
        
        if (text) {
          cues.push({
            id: `${start}-${end}`,
            start,
            end,
            text: text.trim()
          });
        }
      } else {
        i++;
      }
    } else {
      i++;
    }
  }
  
  return cues;
};

const parseTime = (timeStr: string): number => {
  // Format: HH:MM:SS,ms or HH:MM:SS.ms
  // Handle optional hours
  const parts = timeStr.replace(',', '.').split(':');
  
  if (parts.length === 3) {
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2]);
    return h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    return m * 60 + s;
  }
  return 0;
};
