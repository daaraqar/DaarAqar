const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
});

const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, key);

async function cleanTable(tableName, idCol = 'id') {
  try {
    const { data, error } = await supabase.from(tableName).delete().neq(idCol, '00000000-0000-0000-0000-000000000000');
    if (error) {
      console.warn(`Clean ${tableName} notice:`, error.message);
    } else {
      console.log(`Cleaned ${tableName} successfully.`);
    }
  } catch (e) {
    console.warn(`Clean ${tableName} exception:`, e.message);
  }
}

async function run() {
  console.log('--- Cleaning Supabase live tables ---');
  await cleanTable('favorites', 'user_id');
  await cleanTable('inquiry_messages');
  await cleanTable('inquiries');
  await cleanTable('inspection_bookings');
  await cleanTable('property_reports');
  await cleanTable('property_images');
  await cleanTable('reservations');
  await cleanTable('reverse_requests');
  await cleanTable('properties');

  // Clean non-admin profiles
  try {
    const { data: profs, error: profErr } = await supabase
      .from('profiles')
      .delete()
      .neq('role', 'admin');
    if (profErr) {
      console.warn('Profiles cleanup notice:', profErr.message);
    } else {
      console.log('Cleaned non-admin profiles successfully.');
    }
  } catch (e) {
    console.warn('Profiles cleanup exception:', e.message);
  }

  // Count remaining
  const { data: remProps } = await supabase.from('properties').select('id');
  const { data: remProfs } = await supabase.from('profiles').select('id, email, role');
  console.log('Remaining properties count:', remProps ? remProps.length : 0);
  console.log('Remaining profiles:', remProfs);
}

run();
