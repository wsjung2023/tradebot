
import fs from 'fs';

const logPath = 'd:/Projects/tradebot/.tmp-ui-dev.out.log';

function readLastLines() {
    if (!fs.existsSync(logPath)) {
        console.log('Log file not found');
        return;
    }

    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.split('\n');
    const lastLines = lines.slice(-200);
    
    lastLines.forEach(line => console.log(line.trim()));
}

readLastLines();
