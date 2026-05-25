CREATE TABLE IF NOT EXISTS role_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('am','mid','pm')),
  task_name TEXT NOT NULL,
  task_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shift_task_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
  task_id UUID REFERENCES role_tasks(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(schedule_id, task_id)
);

ALTER TABLE role_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can do everything" ON role_tasks
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Admins can do everything" ON shift_task_assignments
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
