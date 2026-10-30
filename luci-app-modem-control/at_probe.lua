local nixio = require "nixio"

local port = arg[1] or "/dev/ttyUSB1"
local fd = nixio.open(port, nixio.open_flags("rdwr", "nonblock"))
if not fd then print("OPEN_FAIL") return end

local function drain()
  for i = 1, 40 do
    local r = fd:read(512)
    if not r or #r == 0 then break end
    nixio.nanosleep(0, 10000000)
  end
end

local function at(cmd)
  drain()
  fd:write(cmd .. "\r\n")
  local buf = ""
  for i = 1, 60 do
    nixio.nanosleep(0, 100000000)
    local r = fd:read(1024)
    if r and #r > 0 then
      buf = buf .. r
      if buf:find("\r\nOK") or buf:find("OK\r\n") or buf:find("ERROR") then break end
    end
  end
  return (buf:gsub("\r", ""))
end

drain()
at("ATE0")

local cmds = {
  "AT",
  "ATI",
  "AT+CPIN?",
  "AT+CSQ",
  "AT+CREG?",
  "AT+CEREG?",
  "AT+COPS?",
  "AT+CMGF=?",
  "AT+CPMS=?",
  "AT+CPMS?",
  "AT+CNMI?",
  "AT+CSDH?",
  "AT+CMGL=?",
  "AT+CMEE=1",
}

for _, c in ipairs(cmds) do
  print("=== " .. c .. " ===")
  print(at(c))
end

fd:close()
