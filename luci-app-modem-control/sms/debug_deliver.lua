package.path = "/storage/emulated/0/Download/路由器520/luci-app-modem-control/sms/?.lua;" .. package.path
local pdu = require("pdu")

local test_pdu = "00" .. "04" .. "0B" .. "91" .. "683108100100F0" ..
	"00" .. "08" .. "21201151826100" .. "04" .. "4F60597D"

print("PDU: " .. test_pdu .. "  (len=" .. #test_pdu .. ")")

-- 手动逐步跟踪
local hex = test_pdu:upper()
local pos = 1
local function readhex(n) local s = hex:sub(pos, pos+n-1); pos = pos + n; return s end
local function readbyte() local s = hex:sub(pos, pos+1); pos = pos + 2; return tonumber(s, 16) or 0 end

local smsc_len = readbyte()
print("1. SMSC len byte = " .. smsc_len)
if smsc_len > 0 then readhex(smsc_len*2) end

local first = readbyte()
print(string.format("2. first octet = 0x%02X, MTI = %d", first, first % 4))

local addr_len = readbyte()
print("3. addr_len = " .. addr_len .. " (digits)")
local addr_bytes = math.ceil(addr_len / 2)
print("   addr_bytes = " .. addr_bytes)

local toa = readhex(2)
print("4. TOA = " .. toa)
local addr_hex = readhex(addr_bytes * 2)
print("5. addr_hex = " .. addr_hex)

local pid = readbyte()
local dcs = readbyte()
print(string.format("6. PID=0x%02X  DCS=0x%02X  alphabet=%d", pid, dcs, math.floor(dcs/4)%4))

local scts = readhex(14)
print("7. SCTS = " .. scts)

local udl = readbyte()
print("8. UDL = " .. udl)

local rest = hex:sub(pos)
print("9. remaining = " .. rest .. "  (len=" .. #rest .. ")")

print("\n--- decode_deliver 结果 ---")
local d = pdu.decode_deliver(test_pdu)
if d then
	for k, v in pairs(d) do print("  " .. k .. " = " .. tostring(v)) end
else
	print("  nil")
end