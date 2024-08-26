# Design decision

The floorplan_points table has a 'type' field, it has been designed that types 50+ will be border nodes, i.e. nodes that lie on another floor (e.g. stairs, elevator, or just a common point).
To exclude these 'border points', `AND type < 50` in the SQL WHERE clause will address this (50 is set by `BORDERING_FLOOR_POINT_DEFAULT_TYPE`)

