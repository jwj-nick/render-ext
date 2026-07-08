`timescale 1ns / 1ps

module axi_arbiter #(
    parameter int NM         = 4,
    parameter int ID_WIDTH   = 4,
    parameter int ADDR_WIDTH = 32,
    parameter int DATA_WIDTH = 32,
    parameter int USER_WIDTH = 1,
    parameter bit PIPELINE_SLAVE = 1 // Insert Register Slice on Slave Interface
) (
    input  logic clk,
    input  logic rst_n,

    // ---------------------------------------------------------
    // AXI Slave Interfaces (Connected to N Masters)
    // ---------------------------------------------------------
    // Write Address
    input  logic [NM-1:0]                   s_axi_awvalid,
    output logic [NM-1:0]                   s_axi_awready,
    input  logic [NM*ID_WIDTH-1:0]          s_axi_awid,
    input  logic [NM*ADDR_WIDTH-1:0]        s_axi_awaddr,
    input  logic [NM*8-1:0]                 s_axi_awlen,
    input  logic [NM*3-1:0]                 s_axi_awsize,
    input  logic [NM*2-1:0]                 s_axi_awburst,
    input  logic [NM-1:0]                   s_axi_awlock,
    input  logic [NM*4-1:0]                 s_axi_awcache,
    input  logic [NM*3-1:0]                 s_axi_awprot,
    input  logic [NM*4-1:0]                 s_axi_awqos,
    input  logic [NM*USER_WIDTH-1:0]        s_axi_awuser,

    // Write Data
    input  logic [NM-1:0]                   s_axi_wvalid,
    output logic [NM-1:0]                   s_axi_wready,
    input  logic [NM*DATA_WIDTH-1:0]        s_axi_wdata,
    input  logic [NM*DATA_WIDTH/8-1:0]      s_axi_wstrb,
    input  logic [NM-1:0]                   s_axi_wlast,
    input  logic [NM*USER_WIDTH-1:0]        s_axi_wuser,

    // Write Response
    output logic [NM-1:0]                   s_axi_bvalid,
    input  logic [NM-1:0]                   s_axi_bready,
    output logic [NM*ID_WIDTH-1:0]          s_axi_bid,
    output logic [NM*2-1:0]                 s_axi_bresp,
    output logic [NM*USER_WIDTH-1:0]        s_axi_buser,

    // Read Address
    input  logic [NM-1:0]                   s_axi_arvalid,
    output logic [NM-1:0]                   s_axi_arready,
    input  logic [NM*ID_WIDTH-1:0]          s_axi_arid,
    input  logic [NM*ADDR_WIDTH-1:0]        s_axi_araddr,
    input  logic [NM*8-1:0]                 s_axi_arlen,
    input  logic [NM*3-1:0]                 s_axi_arsize,
    input  logic [NM*2-1:0]                 s_axi_arburst,
    input  logic [NM-1:0]                   s_axi_arlock,
    input  logic [NM*4-1:0]                 s_axi_arcache,
    input  logic [NM*3-1:0]                 s_axi_arprot,
    input  logic [NM*4-1:0]                 s_axi_arqos,
    input  logic [NM*USER_WIDTH-1:0]        s_axi_aruser,

    // Read Data
    output logic [NM-1:0]                   s_axi_rvalid,
    input  logic [NM-1:0]                   s_axi_rready,
    output logic [NM*ID_WIDTH-1:0]          s_axi_rid,
    output logic [NM*DATA_WIDTH-1:0]        s_axi_rdata,
    output logic [NM*2-1:0]                 s_axi_rresp,
    output logic [NM-1:0]                   s_axi_rlast,
    output logic [NM*USER_WIDTH-1:0]        s_axi_ruser,

    // ---------------------------------------------------------
    // AXI Master Interface (Connected to 1 Slave)
    // ---------------------------------------------------------
    // Write Address
    output logic                            m_axi_awvalid,
    input  logic                            m_axi_awready,
    output logic [ID_WIDTH+$clog2(NM)-1:0]  m_axi_awid,
    output logic [ADDR_WIDTH-1:0]           m_axi_awaddr,
    output logic [7:0]                      m_axi_awlen,
    output logic [2:0]                      m_axi_awsize,
    output logic [1:0]                      m_axi_awburst,
    output logic                            m_axi_awlock,
    output logic [3:0]                      m_axi_awcache,
    output logic [2:0]                      m_axi_awprot,
    output logic [3:0]                      m_axi_awqos,
    output logic [USER_WIDTH-1:0]           m_axi_awuser,

    // Write Data
    output logic                            m_axi_wvalid,
    input  logic                            m_axi_wready,
    output logic [DATA_WIDTH-1:0]           m_axi_wdata,
    output logic [DATA_WIDTH/8-1:0]         m_axi_wstrb,
    output logic                            m_axi_wlast,
    output logic [USER_WIDTH-1:0]           m_axi_wuser,

    // Write Response
    input  logic                            m_axi_bvalid,
    output logic                            m_axi_bready,
    input  logic [ID_WIDTH+$clog2(NM)-1:0]  m_axi_bid,
    input  logic [1:0]                      m_axi_bresp,
    input  logic [USER_WIDTH-1:0]           m_axi_buser,

    // Read Address
    output logic                            m_axi_arvalid,
    input  logic                            m_axi_arready,
    output logic [ID_WIDTH+$clog2(NM)-1:0]  m_axi_arid,
    output logic [ADDR_WIDTH-1:0]           m_axi_araddr,
    output logic [7:0]                      m_axi_arlen,
    output logic [2:0]                      m_axi_arsize,
    output logic [1:0]                      m_axi_arburst,
    output logic                            m_axi_arlock,
    output logic [3:0]                      m_axi_arcache,
    output logic [2:0]                      m_axi_arprot,
    output logic [3:0]                      m_axi_arqos,
    output logic [USER_WIDTH-1:0]           m_axi_aruser,

    // Read Data
    input  logic                            m_axi_rvalid,
    output logic                            m_axi_rready,
    input  logic [ID_WIDTH+$clog2(NM)-1:0]  m_axi_rid,
    input  logic [DATA_WIDTH-1:0]           m_axi_rdata,
    input  logic [1:0]                      m_axi_rresp,
    input  logic                            m_axi_rlast,
    input  logic [USER_WIDTH-1:0]           m_axi_ruser
);

    // Internal Signals (Arbiter Output -> Register Slice Input)
    // AW
    logic                            arb_awvalid;
    logic                            arb_awready;
    logic [ID_WIDTH+$clog2(NM)-1:0]  arb_awid;
    logic [ADDR_WIDTH-1:0]           arb_awaddr;
    logic [7:0]                      arb_awlen;
    logic [2:0]                      arb_awsize;
    logic [1:0]                      arb_awburst;
    logic                            arb_awlock;
    logic [3:0]                      arb_awcache;
    logic [2:0]                      arb_awprot;
    logic [3:0]                      arb_awqos;
    logic [USER_WIDTH-1:0]           arb_awuser;

    // W
    logic                            arb_wvalid;
    logic                            arb_wready;
    logic [DATA_WIDTH-1:0]           arb_wdata;
    logic [DATA_WIDTH/8-1:0]         arb_wstrb;
    logic                            arb_wlast;
    logic [USER_WIDTH-1:0]           arb_wuser;

    // B
    logic                            arb_bvalid;
    logic                            arb_bready;
    logic [ID_WIDTH+$clog2(NM)-1:0]  arb_bid;
    logic [1:0]                      arb_bresp;
    logic [USER_WIDTH-1:0]           arb_buser;

    // AR
    logic                            arb_arvalid;
    logic                            arb_arready;
    logic [ID_WIDTH+$clog2(NM)-1:0]  arb_arid;
    logic [ADDR_WIDTH-1:0]           arb_araddr;
    logic [7:0]                      arb_arlen;
    logic [2:0]                      arb_arsize;
    logic [1:0]                      arb_arburst;
    logic                            arb_arlock;
    logic [3:0]                      arb_arcache;
    logic [2:0]                      arb_arprot;
    logic [3:0]                      arb_arqos;
    logic [USER_WIDTH-1:0]           arb_aruser;

    // R
    logic                            arb_rvalid;
    logic                            arb_rready;
    logic [ID_WIDTH+$clog2(NM)-1:0]  arb_rid;
    logic [DATA_WIDTH-1:0]           arb_rdata;
    logic [1:0]                      arb_rresp;
    logic                            arb_rlast;
    logic [USER_WIDTH-1:0]           arb_ruser;

    // FIFO Signals
    logic                            w_fifo_push;
    logic [$clog2(NM)-1:0]           w_fifo_data_in;
    logic                            w_fifo_full;
    logic                            w_fifo_empty;
    logic                            w_fifo_pop;
    logic                            w_fifo_read_en;
    logic [$clog2(NM)-1:0]           w_fifo_data_out;

    // ---------------------------------------------------------
    // 1. Instantiate Arbiters
    // ---------------------------------------------------------

    axi_arbiter_aw #(
        .NM(NM), .ID_WIDTH(ID_WIDTH), .ADDR_WIDTH(ADDR_WIDTH), .USER_WIDTH(USER_WIDTH)
    ) u_aw_arb (
        .clk(clk), .rst_n(rst_n),
        .s_awvalid(s_axi_awvalid), .s_awready(s_axi_awready), .s_awid(s_axi_awid), .s_awaddr(s_axi_awaddr),
        .s_awlen(s_axi_awlen), .s_awsize(s_axi_awsize), .s_awburst(s_axi_awburst), .s_awlock(s_axi_awlock),
        .s_awcache(s_axi_awcache), .s_awprot(s_axi_awprot), .s_awqos(s_axi_awqos), .s_awuser(s_axi_awuser),
        .m_awvalid(arb_awvalid), .m_awready(arb_awready), .m_awid(arb_awid), .m_awaddr(arb_awaddr),
        .m_awlen(arb_awlen), .m_awsize(arb_awsize), .m_awburst(arb_awburst), .m_awlock(arb_awlock),
        .m_awcache(arb_awcache), .m_awprot(arb_awprot), .m_awqos(arb_awqos), .m_awuser(arb_awuser),
        .w_fifo_push(w_fifo_push), .w_fifo_data(w_fifo_data_in), .w_fifo_full(w_fifo_full)
    );

    axi_arbiter_w #(
        .NM(NM), .DATA_WIDTH(DATA_WIDTH), .USER_WIDTH(USER_WIDTH)
    ) u_w_arb (
        .clk(clk), .rst_n(rst_n),
        .s_wvalid(s_axi_wvalid), .s_wready(s_axi_wready), .s_wdata(s_axi_wdata),
        .s_wstrb(s_axi_wstrb), .s_wlast(s_axi_wlast), .s_wuser(s_axi_wuser),
        .m_wvalid(arb_wvalid), .m_wready(arb_wready), .m_wdata(arb_wdata),
        .m_wstrb(arb_wstrb), .m_wlast(arb_wlast), .m_wuser(arb_wuser),
        .w_fifo_empty(w_fifo_empty), .w_fifo_pop(), .w_fifo_read_en(w_fifo_read_en), .w_fifo_data(w_fifo_data_out)
    );

    axi_arbiter_b #(
        .NM(NM), .ID_WIDTH(ID_WIDTH), .USER_WIDTH(USER_WIDTH)
    ) u_b_arb (
        .clk(clk), .rst_n(rst_n),
        .s_bvalid(s_axi_bvalid), .s_bready(s_axi_bready), .s_bid(s_axi_bid),
        .s_bresp(s_axi_bresp), .s_buser(s_axi_buser),
        .m_bvalid(arb_bvalid), .m_bready(arb_bready), .m_bid(arb_bid),
        .m_bresp(arb_bresp), .m_buser(arb_buser)
    );

    axi_arbiter_ar #(
        .NM(NM), .ID_WIDTH(ID_WIDTH), .ADDR_WIDTH(ADDR_WIDTH), .USER_WIDTH(USER_WIDTH)
    ) u_ar_arb (
        .clk(clk), .rst_n(rst_n),
        .s_arvalid(s_axi_arvalid), .s_arready(s_axi_arready), .s_arid(s_axi_arid), .s_araddr(s_axi_araddr),
        .s_arlen(s_axi_arlen), .s_arsize(s_axi_arsize), .s_arburst(s_axi_arburst), .s_arlock(s_axi_arlock),
        .s_arcache(s_axi_arcache), .s_arprot(s_axi_arprot), .s_arqos(s_axi_arqos), .s_aruser(s_axi_aruser),
        .m_arvalid(arb_arvalid), .m_arready(arb_arready), .m_arid(arb_arid), .m_araddr(arb_araddr),
        .m_arlen(arb_arlen), .m_arsize(arb_arsize), .m_arburst(arb_arburst), .m_arlock(arb_arlock),
        .m_arcache(arb_arcache), .m_arprot(arb_arprot), .m_arqos(arb_arqos), .m_aruser(arb_aruser)
    );

    axi_arbiter_r #(
        .NM(NM), .ID_WIDTH(ID_WIDTH), .DATA_WIDTH(DATA_WIDTH), .USER_WIDTH(USER_WIDTH)
    ) u_r_arb (
        .clk(clk), .rst_n(rst_n),
        .s_rvalid(s_axi_rvalid), .s_rready(s_axi_rready), .s_rid(s_axi_rid),
        .s_rdata(s_axi_rdata), .s_rresp(s_axi_rresp), .s_rlast(s_axi_rlast), .s_ruser(s_axi_ruser),
        .m_rvalid(arb_rvalid), .m_rready(arb_rready), .m_rid(arb_rid),
        .m_rdata(arb_rdata), .m_rresp(arb_rresp), .m_rlast(arb_rlast), .m_ruser(arb_ruser)
    );

    // ---------------------------------------------------------
    // 2. FIFO Implementation (AW -> W)
    // ---------------------------------------------------------
    // Simple synchronous FIFO
    localparam int FIFO_DEPTH = 16; // Can be parameterized
    logic [$clog2(NM)-1:0] fifo_mem [FIFO_DEPTH-1:0];
    logic [$clog2(FIFO_DEPTH)-1:0] wr_ptr, rd_ptr;
    logic [$clog2(FIFO_DEPTH):0]   count;

    assign w_fifo_full  = (count == FIFO_DEPTH);
    assign w_fifo_empty = (count == 0);
    assign w_fifo_data_out = fifo_mem[rd_ptr];

    always_ff @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            wr_ptr <= '0;
            rd_ptr <= '0;
            count  <= '0;
        end else begin
            if (w_fifo_push && !w_fifo_full) begin
                fifo_mem[wr_ptr] <= w_fifo_data_in;
                wr_ptr <= wr_ptr + 1'b1;
                if (!w_fifo_read_en) count <= count + 1'b1;
            end
            
            if (w_fifo_read_en && !w_fifo_empty) begin
                rd_ptr <= rd_ptr + 1'b1;
                if (!w_fifo_push) count <= count - 1'b1;
            end
        end
    end

    // ---------------------------------------------------------
    // 3. Register Slices (Optional)
    // ---------------------------------------------------------
    // Note: For brevity, only showing instantiation logic. 
    // In a real design, we would instantiate axi_register_slice for each channel.
    // Here we connect Arbiter outputs directly to Module outputs if PIPELINE_SLAVE=0.
    
    // AW Channel
    generate if (PIPELINE_SLAVE) begin : gen_aw_slice
        axi_register_slice #(.DATA_WIDTH(ID_WIDTH+$clog2(NM)+ADDR_WIDTH+8+3+2+1+4+3+4+USER_WIDTH)) u_slice_aw (
            .clk(clk), .rst_n(rst_n),
            .s_valid(arb_awvalid), .s_ready(arb_awready),
            .s_data({arb_awid, arb_awaddr, arb_awlen, arb_awsize, arb_awburst, arb_awlock, arb_awcache, arb_awprot, arb_awqos, arb_awuser}),
            .m_valid(m_axi_awvalid), .m_ready(m_axi_awready),
            .m_data({m_axi_awid, m_axi_awaddr, m_axi_awlen, m_axi_awsize, m_axi_awburst, m_axi_awlock, m_axi_awcache, m_axi_awprot, m_axi_awqos, m_axi_awuser})
        );
    end else begin
        assign m_axi_awvalid = arb_awvalid;
        assign arb_awready   = m_axi_awready;
        assign m_axi_awid    = arb_awid;
        assign m_axi_awaddr  = arb_awaddr;
        assign m_axi_awlen   = arb_awlen;
        assign m_axi_awsize  = arb_awsize;
        assign m_axi_awburst = arb_awburst;
        assign m_axi_awlock  = arb_awlock;
        assign m_axi_awcache = arb_awcache;
        assign m_axi_awprot  = arb_awprot;
        assign m_axi_awqos   = arb_awqos;
        assign m_axi_awuser  = arb_awuser;
    end endgenerate

    // W Channel
    generate if (PIPELINE_SLAVE) begin : gen_w_slice
        axi_register_slice #(.DATA_WIDTH(DATA_WIDTH+DATA_WIDTH/8+1+USER_WIDTH)) u_slice_w (
            .clk(clk), .rst_n(rst_n),
            .s_valid(arb_wvalid), .s_ready(arb_wready),
            .s_data({arb_wdata, arb_wstrb, arb_wlast, arb_wuser}),
            .m_valid(m_axi_wvalid), .m_ready(m_axi_wready),
            .m_data({m_axi_wdata, m_axi_wstrb, m_axi_wlast, m_axi_wuser})
        );
    end else begin
        assign m_axi_wvalid = arb_wvalid;
        assign arb_wready   = m_axi_wready;
        assign m_axi_wdata  = arb_wdata;
        assign m_axi_wstrb  = arb_wstrb;
        assign m_axi_wlast  = arb_wlast;
        assign m_axi_wuser  = arb_wuser;
    end endgenerate

    // B Channel (Reverse direction: Slave -> Arbiter)
    generate if (PIPELINE_SLAVE) begin : gen_b_slice
        axi_register_slice #(.DATA_WIDTH(ID_WIDTH+$clog2(NM)+2+USER_WIDTH)) u_slice_b (
            .clk(clk), .rst_n(rst_n),
            .s_valid(m_axi_bvalid), .s_ready(m_axi_bready),
            .s_data({m_axi_bid, m_axi_bresp, m_axi_buser}),
            .m_valid(arb_bvalid), .m_ready(arb_bready),
            .m_data({arb_bid, arb_bresp, arb_buser})
        );
    end else begin
        assign arb_bvalid   = m_axi_bvalid;
        assign m_axi_bready = arb_bready;
        assign arb_bid      = m_axi_bid;
        assign arb_bresp    = m_axi_bresp;
        assign arb_buser    = m_axi_buser;
    end endgenerate

    // AR Channel
    generate if (PIPELINE_SLAVE) begin : gen_ar_slice
        axi_register_slice #(.DATA_WIDTH(ID_WIDTH+$clog2(NM)+ADDR_WIDTH+8+3+2+1+4+3+4+USER_WIDTH)) u_slice_ar (
            .clk(clk), .rst_n(rst_n),
            .s_valid(arb_arvalid), .s_ready(arb_arready),
            .s_data({arb_arid, arb_araddr, arb_arlen, arb_arsize, arb_arburst, arb_arlock, arb_arcache, arb_arprot, arb_arqos, arb_aruser}),
            .m_valid(m_axi_arvalid), .m_ready(m_axi_arready),
            .m_data({m_axi_arid, m_axi_araddr, m_axi_arlen, m_axi_arsize, m_axi_arburst, m_axi_arlock, m_axi_arcache, m_axi_arprot, m_axi_arqos, m_axi_aruser})
        );
    end else begin
        assign m_axi_arvalid = arb_arvalid;
        assign arb_arready   = m_axi_arready;
        assign m_axi_arid    = arb_arid;
        assign m_axi_araddr  = arb_araddr;
        assign m_axi_arlen   = arb_arlen;
        assign m_axi_arsize  = arb_arsize;
        assign m_axi_arburst = arb_arburst;
        assign m_axi_arlock  = arb_arlock;
        assign m_axi_arcache = arb_arcache;
        assign m_axi_arprot  = arb_arprot;
        assign m_axi_arqos   = arb_arqos;
        assign m_axi_aruser  = arb_aruser;
    end endgenerate

    // R Channel (Reverse direction: Slave -> Arbiter)
    generate if (PIPELINE_SLAVE) begin : gen_r_slice
        axi_register_slice #(.DATA_WIDTH(ID_WIDTH+$clog2(NM)+DATA_WIDTH+2+1+USER_WIDTH)) u_slice_r (
            .clk(clk), .rst_n(rst_n),
            .s_valid(m_axi_rvalid), .s_ready(m_axi_rready),
            .s_data({m_axi_rid, m_axi_rdata, m_axi_rresp, m_axi_rlast, m_axi_ruser}),
            .m_valid(arb_rvalid), .m_ready(arb_rready),
            .m_data({arb_rid, arb_rdata, arb_rresp, arb_rlast, arb_ruser})
        );
    end else begin
        assign arb_rvalid   = m_axi_rvalid;
        assign m_axi_rready = arb_rready;
        assign arb_rid      = m_axi_rid;
        assign arb_rdata    = m_axi_rdata;
        assign arb_rresp    = m_axi_rresp;
        assign arb_rlast    = m_axi_rlast;
        assign arb_ruser    = m_axi_ruser;
    end endgenerate

endmodule
