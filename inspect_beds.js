import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env vars
const envConfig = dotenv.parse(fs.readFileSync('.env'));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectBeds() {
    console.log("Checking beds...");
    const { data, error } = await supabase
        .from('all_floor_bed')
        .select('*')
        .ilike('ward', '%female%')
        .ilike('bed', '%2%');

    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Found beds:", data);
    }
}

inspectBeds();
