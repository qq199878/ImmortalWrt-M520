// SPDX-License-Identifier: GPL-2.0-only
/*
 * QCA DSA user-port to NSS PORTID bridge.
 *
 * The module deliberately binds only after the DSA user netdevices exist.
 * Each binding is transactional: any failed step releases all earlier state.
 */
#include <linux/errno.h>
#include <linux/etherdevice.h>
#include <linux/if_ether.h>
#include <linux/module.h>
#include <linux/mutex.h>
#include <linux/netdevice.h>
#include <linux/notifier.h>
#include <linux/skbuff.h>
#include <linux/workqueue.h>

#include <nss_api_if.h>
#include <nss_cmn.h>
#include <nss_dynamic_interface.h>
#include <nss_portid.h>
#include <nss_capwap.h>

#define PORTID_RETRY_MS 3000
#define PORTID_BINDINGS 2

struct portid_binding {
const char *name;
u8 port_id;
u8 gmac_id;
int if_num;
struct net_device *netdev;
struct nss_ctx_instance *nss_ctx;
bool configured;
};

static DEFINE_MUTEX(portid_lock);
static struct delayed_work portid_bind_work;
static bool portid_stopping;

static struct portid_binding portid_bindings[PORTID_BINDINGS] = {
{
.name = "wan",
.port_id = 5,
.gmac_id = 1,
.if_num = -1,
},
{
.name = "lan1",
.port_id = 1,
.gmac_id = 2,
.if_num = -1,
},
};

static void portid_receive(struct net_device *netdev, struct sk_buff *skb,
   struct napi_struct *napi)
{
if (!netdev || !skb) {
kfree_skb(skb);
return;
}

skb->dev = netdev;
skb->protocol = eth_type_trans(skb, netdev);
if (napi)
napi_gro_receive(napi, skb);
else
netif_receive_skb(skb);
}

static void portid_clear_binding(struct portid_binding *binding)
{
binding->if_num = -1;
binding->netdev = NULL;
binding->nss_ctx = NULL;
binding->configured = false;
}

static void portid_unbind_one(struct portid_binding *binding)
{
if (binding->if_num < 0)
return;

if (binding->configured) {
nss_portid_tx_unconfigure_port_if_msg(binding->nss_ctx,
      binding->if_num,
      binding->port_id);
binding->configured = false;
}

nss_portid_unregister_port_if(binding->if_num);
nss_dynamic_interface_dealloc_node(binding->if_num,
   NSS_DYNAMIC_INTERFACE_TYPE_PORTID);

if (binding->netdev)
dev_put(binding->netdev);

portid_clear_binding(binding);
}

static int portid_bind_one(struct portid_binding *binding)
{
struct net_device *netdev;
struct nss_ctx_instance *nss_ctx;
nss_tx_status_t status;
int if_num;

if (binding->if_num >= 0)
return 0;

netdev = dev_get_by_name(&init_net, binding->name);
if (!netdev) {
return -ENODEV;
}

if_num = nss_dynamic_interface_alloc_node(
NSS_DYNAMIC_INTERFACE_TYPE_PORTID);
if (if_num < 0) {
dev_put(netdev);
return -EAGAIN;
}

nss_ctx = nss_portid_register_port_if(if_num, binding->port_id,
      netdev, portid_receive);
if (!nss_ctx) {
nss_dynamic_interface_dealloc_node(
if_num, NSS_DYNAMIC_INTERFACE_TYPE_PORTID);
dev_put(netdev);
return -EIO;
}

status = nss_portid_tx_configure_port_if_msg(nss_ctx, if_num,
     binding->port_id,
     binding->gmac_id);
if (status != NSS_TX_SUCCESS) {
nss_portid_unregister_port_if(if_num);
nss_dynamic_interface_dealloc_node(
if_num, NSS_DYNAMIC_INTERFACE_TYPE_PORTID);
dev_put(netdev);
return -EIO;
}

binding->if_num = if_num;
binding->netdev = netdev;
binding->nss_ctx = nss_ctx;
binding->configured = true;

pr_info("bound %s to NSS PORTID %d (switch port %u, GMAC %u)\n",
binding->name, binding->if_num, binding->port_id,
binding->gmac_id);
return 0;
}

static void portid_bind_workfn(struct work_struct *work)
{
bool retry = false;
int i;

if (READ_ONCE(portid_stopping))
return;

mutex_lock(&portid_lock);
for (i = 0; i < PORTID_BINDINGS; i++) {
int ret;

if (portid_bindings[i].if_num >= 0)
continue;

ret = portid_bind_one(&portid_bindings[i]);
if (ret)
retry = true;
}
mutex_unlock(&portid_lock);

if (retry && !READ_ONCE(portid_stopping))
schedule_delayed_work(&portid_bind_work,
      msecs_to_jiffies(PORTID_RETRY_MS));
}

static int portid_netdev_event(struct notifier_block *nb,
       unsigned long event, void *data)
{
struct net_device *netdev = netdev_notifier_info_to_dev(data);
int i;

switch (event) {
case NETDEV_REGISTER:
case NETDEV_UP:
schedule_delayed_work(&portid_bind_work, 0);
break;
case NETDEV_UNREGISTER:
mutex_lock(&portid_lock);
for (i = 0; i < PORTID_BINDINGS; i++) {
if (portid_bindings[i].netdev == netdev)
portid_unbind_one(&portid_bindings[i]);
}
mutex_unlock(&portid_lock);
break;
default:
break;
}

return NOTIFY_DONE;
}

static struct notifier_block portid_netdev_nb = {
.notifier_call = portid_netdev_event,
};

static void portid_probe_fw(void)
{
struct nss_ctx_instance *ctx;
struct nss_portid_msg npm;
struct nss_portid_configure_msg *npcm;
nss_tx_status_t st;
ctx = nss_capwap_get_ctx();
pr_info("P4 ctx=%px\n", (void *)ctx);
if (!ctx) {
pr_info("P4 ctx NULL abort\n");
return;
}
memset(&npm, 0, sizeof(npm));
npcm = &npm.msg.configure;
npcm->port_if_num = NSS_DYNAMIC_IF_START + 0;
npcm->port_id = 5;
npcm->gmac_id = 1;
nss_portid_msg_init(&npm, NSS_PORTID_INTERFACE, NSS_PORTID_CONFIGURE_MSG,
sizeof(struct nss_portid_configure_msg), NULL, NULL);
pr_info("P4 sending sync ifnum=%u port=%u gmac=%u\n",
(unsigned int)npcm->port_if_num, (unsigned int)npcm->port_id,
(unsigned int)npcm->gmac_id);
st = nss_portid_tx_msg_sync(ctx, &npm);
pr_info("P4 SYNC RESULT st=%d resp=%d\n", (int)st, (int)npm.cm.response);
}
static int __init qca_nss_portid_init(void)
{
int ret;

WRITE_ONCE(portid_stopping, false);
INIT_DELAYED_WORK(&portid_bind_work, portid_bind_workfn);

ret = register_netdevice_notifier(&portid_netdev_nb);
if (ret)
return ret;

schedule_delayed_work(&portid_bind_work, 0);
portid_probe_fw();
pr_info("QCA NSS PORTID bridge loaded\n");
return 0;
}

static void __exit qca_nss_portid_exit(void)
{
int i;

WRITE_ONCE(portid_stopping, true);
unregister_netdevice_notifier(&portid_netdev_nb);
cancel_delayed_work_sync(&portid_bind_work);

mutex_lock(&portid_lock);
for (i = 0; i < PORTID_BINDINGS; i++)
portid_unbind_one(&portid_bindings[i]);
mutex_unlock(&portid_lock);
pr_info("QCA NSS PORTID bridge unloaded\n");
}

module_init(qca_nss_portid_init);
module_exit(qca_nss_portid_exit);

MODULE_DESCRIPTION("QCA DSA user-port to NSS PORTID bridge");
MODULE_LICENSE("GPL");
MODULE_AUTHOR("OpenWrt community");
MODULE_SOFTDEP("pre: qca-nss-gmac qca-nss-drv");
