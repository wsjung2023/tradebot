
import { LearningService } from '../server/services/learning.service';
import { storage } from '../server/storage';

async function checkLearningStatus() {
  console.log('🔍 Checking Learning System Status...\n');

  const learningService = new LearningService();
  const activeModels = await storage.getActiveAiModels();

  if (activeModels.length === 0) {
    console.log('⚠️ No active AI models found. Nothing to learn.');
    return;
  }

  for (const model of activeModels) {
    console.log(`\n🎯 Analyzing Model: ${model.modelName} (ID: ${model.id})`);
    
    // 1. Check raw performance data count
    const performances = await storage.getTradingPerformance(model.id);
    const completedTrades = performances.filter(p => p.exitPrice !== null);
    
    console.log(`   - Total trade records: ${performances.length}`);
    console.log(`   - Completed trades (exited): ${completedTrades.length}`);

    // 2. Run optimization analysis (dry-run)
    console.log('   - Running optimization analysis...');
    const result = await learningService.optimizeModel(model.id, false, model.userId);
    
    console.log(`   - Analysis Outcome: ${result.appliedChanges ? 'Ready to Optimize' : 'Analysis Only'}`);
    console.log('   - Recommendations:');
    result.recommendations.forEach(r => console.log(`     👉 ${r}`));
  }

  console.log('\n✅ Learning Status Check Completed.');
}

checkLearningStatus().catch(console.error);
