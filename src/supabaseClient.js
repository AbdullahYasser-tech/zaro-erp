import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://crnppzaihmvhvztcpeap.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNybnBwemFpaG12aHZ6dGNwZWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyODI2NjksImV4cCI6MjEwMTg1ODY2OX0.NdEoIg1lKtDQnOGfWaRcRG6fAb591lCuaV9VgOvrbOk";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
