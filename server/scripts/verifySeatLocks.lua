local userId = ARGV[1]
local fencingToken = ARGV[2]
local missingSeatIds = {}

for index, key in ipairs(KEYS) do
  local currentValue = redis.call('GET', key)
  if currentValue then
    local decoded, lock = pcall(cjson.decode, currentValue)
    if not decoded or type(lock) ~= 'table' or lock.userId ~= userId or lock.fencingToken ~= fencingToken then
      table.insert(missingSeatIds, ARGV[index + 2])
    end
  else
    table.insert(missingSeatIds, ARGV[index + 2])
  end
end

return cjson.encode({
  valid = #missingSeatIds == 0,
  missingSeatIds = missingSeatIds
})