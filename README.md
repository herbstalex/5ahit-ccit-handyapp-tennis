# 5ahit-ccit-handyapp-tennis


```sql

CREATE TABLE fitness_tracking (
  id BIGSERIAL PRIMARY KEY,
  device_ip TEXT,
  step_count INTEGER,
  gps_latitude DOUBLE PRECISION,
  gps_longitude DOUBLE PRECISION,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```