export function formatTime(startTime, durationMinutes) {     
    const [hour, minute] = startTime.split(':').map(Number);    
    const start = hour * 60 + minute;     
    const end = start + durationMinutes;     
    return [start, end];   
}