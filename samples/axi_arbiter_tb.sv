`timescale 1ns / 1ps

module axi_arbiter_tb;

    // Parameters
    localparam int NM         = 4;
    localparam int ID_WIDTH   = 4;
    localparam int ADDR_WIDTH = 32;
    localparam int DATA_WIDTH = 32;
    localparam int USER_WIDTH = 1;

    // Clock & Reset
    logic clk;
    logic rst_n;

    // Master Interfaces (Drivers)
    logic [NM-1:0]                   s_awvalid;
    logic [NM-1:0]                   s_awready;
    logic [NM*ID_WIDTH-1:0]          s_awid;
    logic [NM*ADDR_WIDTH-1:0]        s_awaddr;
    logic [NM*8-1:0]                 s_awlen;
    logic [NM*3-1:0]                 s_awsize;
    logic [NM*2-1:0]                 s_awburst;
    logic [NM-1:0]                   s_awlock;
    logic [NM*4-1:0]                 s_awcache;
    logic [NM*3-1:0]                 s_awprot;
    logic [NM*4-1:0]                 s_awqos;
    logic [NM*USER_WIDTH-1:0]        s_awuser;

    logic [NM-1:0]                   s_wvalid;
    logic [NM-1:0]                   s_wready;
    logic [NM*DATA_WIDTH-1:0]        s_wdata;
    logic [NM*DATA_WIDTH/8-1:0]      s_wstrb;
    logic [NM-1:0]                   s_wlast;
    logic [NM*USER_WIDTH-1:0]        s_wuser;

    logic [NM-1:0]                   s_bvalid;
    logic [NM-1:0]                   s_bready;
    logic [NM*ID_WIDTH-1:0]          s_bid;
    logic [NM*2-1:0]                 s_bresp;
    logic [NM*USER_WIDTH-1:0]        s_buser;

    logic [NM-1:0]                   s_arvalid;
    logic [NM-1:0]                   s_arready;
    logic [NM*ID_WIDTH-1:0]          s_arid;
    logic [NM*ADDR_WIDTH-1:0]        s_araddr;
    logic [NM*8-1:0]                 s_arlen;
    logic [NM*3-1:0]                 s_arsize;
    logic [NM*2-1:0]                 s_arburst;
    logic [NM-1:0]                   s_arlock;
    logic [NM*4-1:0]                 s_arcache;
    logic [NM*3-1:0]                 s_arprot;
    logic [NM*4-1:0]                 s_arqos;
    logic [NM*USER_WIDTH-1:0]        s_aruser;

    logic [NM-1:0]                   s_rvalid;
    logic [NM-1:0]                   s_rready;
    logic [NM*ID_WIDTH-1:0]          s_rid;
    logic [NM*DATA_WIDTH-1:0]        s_rdata;
    logic [NM*2-1:0]                 s_rresp;
    logic [NM-1:0]                   s_rlast;
    logic [NM*USER_WIDTH-1:0]        s_ruser;

    // Slave Interface (Monitor/Responder)
    logic                            m_awvalid;
    logic                            m_awready;
    logic [ID_WIDTH+$clog2(NM)-1:0]  m_awid;
    logic [ADDR_WIDTH-1:0]           m_awaddr;
    logic [7:0]                      m_awlen;
    logic [2:0]                      m_awsize;
    logic [1:0]                      m_awburst;
    logic                            m_awlock;
    logic [3:0]                      m_awcache;
    logic [2:0]                      m_awprot;
    logic [3:0]                      m_awqos;
    logic [USER_WIDTH-1:0]           m_awuser;

    logic                            m_wvalid;
    logic                            m_wready;
    logic [DATA_WIDTH-1:0]           m_wdata;
    logic [DATA_WIDTH/8-1:0]         m_wstrb;
    logic                            m_wlast;
    logic [USER_WIDTH-1:0]           m_wuser;

    logic                            m_bvalid;
    logic                            m_bready;
    logic [ID_WIDTH+$clog2(NM)-1:0]  m_bid;
    logic [1:0]                      m_bresp;
    logic [USER_WIDTH-1:0]           m_buser;

    logic                            m_arvalid;
    logic                            m_arready;
    logic [ID_WIDTH+$clog2(NM)-1:0]  m_arid;
    logic [ADDR_WIDTH-1:0]           m_araddr;
    logic [7:0]                      m_arlen;
    logic [2:0]                      m_arsize;
    logic [1:0]                      m_arburst;
    logic                            m_arlock;
    logic [3:0]                      m_arcache;
    logic [2:0]                      m_arprot;
    logic [3:0]                      m_arqos;
    logic [USER_WIDTH-1:0]           m_aruser;

    logic                            m_rvalid;
    logic                            m_rready;
    logic [ID_WIDTH+$clog2(NM)-1:0]  m_rid;
    logic [DATA_WIDTH-1:0]           m_rdata;
    logic [1:0]                      m_rresp;
    logic                            m_rlast;
    logic [USER_WIDTH-1:0]           m_ruser;

    // DUT Instantiation
    axi_arbiter #(
        .NM(NM), .ID_WIDTH(ID_WIDTH), .ADDR_WIDTH(ADDR_WIDTH),
        .DATA_WIDTH(DATA_WIDTH), .USER_WIDTH(USER_WIDTH), .PIPELINE_SLAVE(1)
    ) dut (
        .clk(clk), .rst_n(rst_n),
        // Connect all s_axi_* and m_axi_* signals
        .s_axi_awvalid(s_awvalid), .s_axi_awready(s_awready), .s_axi_awid(s_awid), .s_axi_awaddr(s_awaddr),
        .s_axi_awlen(s_awlen), .s_axi_awsize(s_awsize), .s_axi_awburst(s_awburst), .s_axi_awlock(s_awlock),
        .s_axi_awcache(s_awcache), .s_axi_awprot(s_awprot), .s_axi_awqos(s_awqos), .s_axi_awuser(s_awuser),
        .s_axi_wvalid(s_wvalid), .s_axi_wready(s_wready), .s_axi_wdata(s_wdata), .s_axi_wstrb(s_wstrb),
        .s_axi_wlast(s_wlast), .s_axi_wuser(s_wuser),
        .s_axi_bvalid(s_bvalid), .s_axi_bready(s_bready), .s_axi_bid(s_bid), .s_axi_bresp(s_bresp), .s_axi_buser(s_buser),
        .s_axi_arvalid(s_arvalid), .s_axi_arready(s_arready), .s_axi_arid(s_arid), .s_axi_araddr(s_araddr),
        .s_axi_arlen(s_arlen), .s_axi_arsize(s_arsize), .s_axi_arburst(s_arburst), .s_axi_arlock(s_arlock),
        .s_axi_arcache(s_arcache), .s_axi_arprot(s_arprot), .s_axi_arqos(s_arqos), .s_axi_aruser(s_aruser),
        .s_axi_rvalid(s_rvalid), .s_axi_rready(s_rready), .s_axi_rid(s_rid), .s_axi_rdata(s_rdata),
        .s_axi_rresp(s_rresp), .s_axi_rlast(s_rlast), .s_axi_ruser(s_ruser),
        
        .m_axi_awvalid(m_awvalid), .m_axi_awready(m_awready), .m_axi_awid(m_awid), .m_axi_awaddr(m_awaddr),
        .m_axi_awlen(m_awlen), .m_axi_awsize(m_awsize), .m_axi_awburst(m_awburst), .m_axi_awlock(m_awlock),
        .m_axi_awcache(m_awcache), .m_axi_awprot(m_awprot), .m_axi_awqos(m_awqos), .m_axi_awuser(m_awuser),
        .m_axi_wvalid(m_wvalid), .m_axi_wready(m_wready), .m_axi_wdata(m_wdata), .m_axi_wstrb(m_wstrb),
        .m_axi_wlast(m_wlast), .m_axi_wuser(m_wuser),
        .m_axi_bvalid(m_bvalid), .m_axi_bready(m_bready), .m_axi_bid(m_bid), .m_axi_bresp(m_bresp), .m_axi_buser(m_buser),
        .m_axi_arvalid(m_arvalid), .m_axi_arready(m_arready), .m_axi_arid(m_arid), .m_axi_araddr(m_araddr),
        .m_axi_arlen(m_arlen), .m_axi_arsize(m_arsize), .m_axi_arburst(m_arburst), .m_axi_arlock(m_arlock),
        .m_axi_arcache(m_arcache), .m_axi_arprot(m_arprot), .m_axi_arqos(m_arqos), .m_axi_aruser(m_aruser),
        .m_axi_rvalid(m_rvalid), .m_axi_rready(m_rready), .m_axi_rid(m_rid), .m_axi_rdata(m_rdata),
        .m_axi_rresp(m_rresp), .m_axi_rlast(m_rlast), .m_axi_ruser(m_ruser)
    );

    // Clock Generation
    initial begin
        clk = 0;
        forever #5 clk = ~clk;
    end

    // Reset Generation
    initial begin
        rst_n = 0;
        #100 rst_n = 1;
    end

    // ---------------------------------------------------------
    // Tasks
    // ---------------------------------------------------------
    task automatic master_write(input int id, input logic [31:0] addr, input logic [31:0] data);
        // AW Phase
        s_awvalid[id] <= 1;
        s_awaddr[id*ADDR_WIDTH +: ADDR_WIDTH] <= addr;
        s_awid[id*ID_WIDTH +: ID_WIDTH] <= id; // Use Master Index as ID
        s_awlen[id*8 +: 8] <= 0; // Single beat
        
        wait(s_awready[id]);
        @(posedge clk);
        s_awvalid[id] <= 0;

        // W Phase
        s_wvalid[id] <= 1;
        s_wdata[id*DATA_WIDTH +: DATA_WIDTH] <= data;
        s_wlast[id] <= 1;
        
        wait(s_wready[id]);
        @(posedge clk);
        s_wvalid[id] <= 0;
        s_wlast[id] <= 0;

        // B Phase
        s_bready[id] <= 1;
        wait(s_bvalid[id]);
        @(posedge clk);
        s_bready[id] <= 0;
        
        $display("[Master %0d] Write Done: Addr=%h Data=%h", id, addr, data);
    endtask

    // Slave Responder
    initial begin
        logic [ID_WIDTH+$clog2(NM)-1:0] captured_bid;

        // Default Ready
        m_awready = 0;
        m_wready  = 0;
        m_bvalid  = 0;
        m_arready = 0;
        m_rvalid  = 0;

        wait(rst_n);
        
        fork
            // AW/W/B Handler
            forever begin
                // Random Delay for Ready
                repeat($urandom_range(0, 5)) @(posedge clk);
                m_awready <= 1;
                wait(m_awvalid);
                @(posedge clk);
                m_awready <= 0;
                
                // Capture ID for Response
                captured_bid = m_awid;

                // W Phase
                repeat($urandom_range(0, 5)) @(posedge clk);
                m_wready <= 1;
                wait(m_wvalid && m_wlast);
                @(posedge clk);
                m_wready <= 0;

                // B Phase
                repeat($urandom_range(0, 5)) @(posedge clk);
                m_bvalid <= 1;
                m_bid    <= captured_bid;
                m_bresp  <= 0; // OKAY
                wait(m_bready);
                @(posedge clk);
                m_bvalid <= 0;
            end
        join_none
    end

    // ---------------------------------------------------------
    // Main Test Sequence
    // ---------------------------------------------------------
    initial begin
        // Initialize Inputs
        s_awvalid = 0; s_wvalid = 0; s_bready = 0;
        s_arvalid = 0; s_rready = 0;
        
        wait(rst_n);
        #100;

        $display("Starting Simulation...");

        // Test 1: Single Master Write
        fork
            master_write(0, 32'h1000, 32'hAAAA);
            master_write(1, 32'h2000, 32'hBBBB);
        join

        // Test 2: Concurrent Write (Round Robin Check)
        $display("Starting Concurrent Write Test...");
        fork
            master_write(0, 32'h3000, 32'hCCCC);
            master_write(1, 32'h4000, 32'hDDDD);
            master_write(2, 32'h5000, 32'hEEEE);
            master_write(3, 32'h6000, 32'hFFFF);
        join

        #500;
        $display("Simulation Finished Successfully.");
        $finish;
    end

endmodule
