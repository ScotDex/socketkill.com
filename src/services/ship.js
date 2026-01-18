function dropShipRender(io, pkg) {
    if (!pkg || !pkg.killmail) return;

    const shipId = pkg.killmail.victim.ship_type_id;

    io.emit("raw-kill", {
        id: pkg.killID,
        shipId: shipId,
        shipImageUrl: `https://api.voidspark.org:2053/render/ship/${shipId}`,
        val: pkg.zkb.totalValue,
        isFastEmit: true // Used by frontend to show "Loading..." labels
    });
}

module.exports = dropShipRender;
