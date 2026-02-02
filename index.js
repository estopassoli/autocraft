import { AutoCrafter } from './src/crafter.js';
import { runCalibration } from './src/calibration.js';
import readline from 'readline';

const args = process.argv.slice(2);

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║        AUTO CRAFTER - Path of Exile 2            ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Comandos:                                       ║');
  console.log('║    node index.js              - Inicia o craft   ║');
  console.log('║    node index.js --calibrate  - Calibrar mouse   ║');
  console.log('║    node index.js --test       - Testar OCR       ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');

  if (args.includes('--calibrate')) {
    await runCalibration();
    return;
  }

  const crafter = new AutoCrafter();

  if (args.includes('--test')) {
    await crafter.testCapture();
    return;
  }

  // Modo normal - inicia o crafting
  console.log('⚠️  ATENÇÃO:');
  console.log('1. Certifique-se que o PoE2 está aberto e visível');
  console.log('2. O stash deve estar aberto com o Chaos Orb visível');
  console.log('3. O item alvo deve estar na posição configurada');
  console.log('');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Pressione ENTER para iniciar ou CTRL+C para cancelar...', async () => {
    rl.close();
    
    // Handler para parar com CTRL+C
    process.on('SIGINT', () => {
      console.log('\n\nParando o crafter...');
      crafter.stop();
      process.exit(0);
    });

    const result = await crafter.start();
    
    console.log('\n');
    console.log('Resultado final:');
    console.log(`  Encontrado: ${result.found ? 'SIM! 🎉' : 'Não'}`);
    console.log(`  Tentativas: ${result.attempts}`);
    console.log(`  Duração: ${Math.floor(result.duration / 1000)} segundos`);
    
    process.exit(0);
  });
}

main().catch(console.error);
