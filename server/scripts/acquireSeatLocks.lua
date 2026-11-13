local userId = ARGV[1]
local fencingToken = ARGV[2]
local ttlMs = tonumber(ARGV[3])
local expiresAt = tonumber(ARGV[4])
local conflictingSeatIds = {}

for index, key in ipairs(KEYS) do
  local currentValue = redis.call('GET', key)
  if currentValue then
    local decoded, lock = pcall(cjson.decode, currentValue)
    if not decoded or type(lock) ~= 'table' or lock.userId ~= userId then
      table.insert(conflictingSeatIds, ARGV[index + 4])
    end
  end
end

if #conflictingSeatIds > 0 then
  return cjson.encode({
    success = false,
    conflictingSeatIds = conflictingSeatIds
  })
end

for index, key in ipairs(KEYS) do
  redis.call('SET', key, cjson.encode({
    userId = userId,
    fencingToken = fencingToken,
    expiresAt = expiresAt
  }), 'PX', ttlMs)
end

return cjson.encode({
  success = true,
  fencingToken = fencingToken,
  expiresAt = expiresAt
})