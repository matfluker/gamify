-- Sample Bible-verse game so you can test immediately.
-- Run this AFTER schema.sql.
-- The admin user is a placeholder phone "5555550100" (Mat Fluker stand-in).

insert into users (id, phone, first_name, last_name)
values ('00000000-0000-0000-0000-000000000001', '5555550100', 'Sample', 'Admin')
on conflict (phone) do nothing;

insert into games (id, title, admin_user_id, share_code, direction)
values (
  '00000000-0000-0000-0000-000000000010',
  'Bible Verses (Sample)',
  '00000000-0000-0000-0000-000000000001',
  'BIBLE1',
  'term'
)
on conflict (share_code) do nothing;

insert into memberships (user_id, game_id) values
('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010')
on conflict do nothing;

insert into pairs (game_id, term, definition, sort_order) values
('00000000-0000-0000-0000-000000000010','John 3:16','For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.',1),
('00000000-0000-0000-0000-000000000010','Philippians 4:13','I can do all things through Christ who strengthens me.',2),
('00000000-0000-0000-0000-000000000010','Romans 8:28','And we know that in all things God works for the good of those who love him, who have been called according to his purpose.',3),
('00000000-0000-0000-0000-000000000010','Proverbs 3:5','Trust in the Lord with all your heart and lean not on your own understanding.',4),
('00000000-0000-0000-0000-000000000010','Jeremiah 29:11','For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.',5),
('00000000-0000-0000-0000-000000000010','Psalm 23:1','The Lord is my shepherd, I lack nothing.',6),
('00000000-0000-0000-0000-000000000010','Isaiah 41:10','Do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you.',7),
('00000000-0000-0000-0000-000000000010','Matthew 6:33','But seek first his kingdom and his righteousness, and all these things will be given to you as well.',8),
('00000000-0000-0000-0000-000000000010','Galatians 5:22','But the fruit of the Spirit is love, joy, peace, forbearance, kindness, goodness, faithfulness.',9),
('00000000-0000-0000-0000-000000000010','Joshua 1:9','Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.',10),
('00000000-0000-0000-0000-000000000010','Ephesians 2:8','For it is by grace you have been saved, through faith, and this is not from yourselves, it is the gift of God.',11),
('00000000-0000-0000-0000-000000000010','2 Timothy 1:7','For the Spirit God gave us does not make us timid, but gives us power, love and self-discipline.',12)
on conflict do nothing;
