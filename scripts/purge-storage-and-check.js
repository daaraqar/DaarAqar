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

async function purgeBucket(bucketName) {
  console.log(`Checking bucket: ${bucketName}...`);
  async function listAllFiles(folder = '') {
    const { data: items, error } = await supabase.storage.from(bucketName).list(folder, { limit: 1000 });
    if (error || !items) return [];
    let allPaths = [];
    for (const item of items) {
      const fullPath = folder ? `${folder}/${item.name}` : item.name;
      if (item.id === null) {
        // Folder -> recurse
        const sub = await listAllFiles(fullPath);
        allPaths = allPaths.concat(sub);
      } else {
        allPaths.push(fullPath);
      }
    }
    return allPaths;
  }

  try {
    const allPaths = await listAllFiles();
    console.log(`Found ${allPaths.length} total files in ${bucketName}:`, allPaths);
    if (allPaths.length > 0) {
      const { error: delErr } = await supabase.storage.from(bucketName).remove(allPaths);
      if (delErr) {
        console.warn(`Error removing files from ${bucketName}:`, delErr.message);
      } else {
        console.log(`Successfully removed ${allPaths.length} files from ${bucketName}.`);
      }
    } else {
      console.log(`Bucket ${bucketName} has 0 files.`);
    }
  } catch (err) {
    console.warn(`Error during purge of ${bucketName}:`, err);
  }
}

async function run() {
  await purgeBucket('property-images');
  await purgeBucket('avatars');
}

run();
