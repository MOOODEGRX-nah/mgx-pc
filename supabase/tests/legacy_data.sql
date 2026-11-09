-- Extra legacy (v1) rows on top of schema.sql's sample builds, covering migration edge cases.
insert into stores (id, name) values ('11111111-1111-1111-1111-111111111111', 'TestStore');
with b as (select id from builds where category = 'budget' limit 1)
insert into parts (build_id, type, part_name, store_id, store_link)
select b.id, x.t, x.n, x.s::uuid, x.l from b, (values
  ('ram', '16GB DDR4 3200MHz', null, null),                                     -- same part twice -> quantity 2
  ('ssd_nvme', 'WD SN770 1TB', '11111111-1111-1111-1111-111111111111', 'https://amazon.sa/x'),
  ('ssd_nvme', 'wd sn770 1tb ', null, 'https://aliexpress.com/y')             -- case/space duplicate -> 2nd offer
) as x(t, n, s, l);
with b as (select id from builds where category = 'high-end' limit 1)
insert into parts (build_id, type, part_name, store_link)
select b.id, 'ssd_nvme', 'WD SN770 1TB', ' https://amazon.sa/x ' from b;      -- same link with spaces -> no new offer
insert into tools (build_id, tool_name, store_link) select id, 'Thermal Paste', 'https://amazon.sa/tp' from builds;
insert into tools (build_id, tool_name) select id, 'thermal paste' from builds where category = 'budget';
