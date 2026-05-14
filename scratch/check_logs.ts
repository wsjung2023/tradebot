
import fs from 'fs';
import path from 'path';

const logPath = 'd:/Projects/tradebot/.tmp-ui-dev.out.log';

function checkLogs() {
    if (!fs.existsSync(logPath)) {
        console.log('Log file not found');
        return;
    }

    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');

    console.log('Checking logs around 13:00...');
    // We look for lines containing "13:0" or "1:0" depending on format
    // And also keywords like "Processing model", "Evaluating", "쿨다운"
    
    const relevantLines = lines.filter(line => {
        const hasTime = line.includes('13:0') || line.includes('1:0');
        const hasKeyword = line.includes('Processing model') || line.includes('Evaluating') || line.includes('쿨다운') || line.includes('스킵');
        return hasTime && hasKeyword;
    });

    console.log(`Found ${relevantLines.length} relevant lines.`);
    relevantLines.slice(-50).forEach(line => console.log(line.trim()));
}

checkLogs();
