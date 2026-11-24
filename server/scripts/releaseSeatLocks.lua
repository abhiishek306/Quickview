local userId = ARGV[1]
local fencingToken = ARGV[2]
local releasedSeatIds = {}

for index, key in ipairs(KEYS) do
  local currentValue = redis.call('GET', key)
  if currentValue then
    local decoded, lock = pcall(cjson.decode, currentValue)
    if decoded and type(lock) == 'table' and lock.userId == userId and lock.fencingToken == fencingToken then
      redis.call('DEL', key)
      table.insert(releasedSeatIds, ARGV[index + 2])
    end
  end
end

return cjson.encode(releasedSeatIds)