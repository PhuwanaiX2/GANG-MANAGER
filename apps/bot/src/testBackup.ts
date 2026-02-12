import 'dotenv/config';
import { runBackup } from './services/backupScheduler';

console.log('🧪 Running manual backup test...');
runBackup().then(() => {
    console.log('✅ Backup test complete!');
    process.exit(0);
}).catch((err) => {
    console.error('❌ Backup test failed:', err);
    process.exit(1);
});
