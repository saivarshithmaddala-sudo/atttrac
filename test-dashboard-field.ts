
import { getMonthlyData } from './src/lib/dashboard';

async function test() {
  try {
    const data = await getMonthlyData(6, 2026, 'FIELD');
    console.log('Field candidates count:', data.length);
    data.forEach(d => console.log(' - ' + d.candidate.name + ' (' + d.candidate.workLocation + ')'));
  } catch (e) {
    console.error(e);
  }
}

test();
