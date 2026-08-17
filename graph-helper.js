/**
 * SikPoket Knowledge Graph Engine (graph-helper.js)
 * 100% native HTML5 Canvas Force-Directed Knowledge Graph.
 * Zero external libraries, zero CSP issues, high-performance Verlet/Euler physics.
 */

(function(global) {
  class KnowledgeGraph {
    constructor(canvas, options = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.options = Object.assign({
        nodeRadius: 10,
        repulsion: 800,
        springLength: 100,
        springStrength: 0.04,
        damping: 0.88,
        centerGravity: 0.015,
        onNodeClick: null,
        onNodeHover: null
      }, options);

      this.nodes = [];
      this.edges = [];
      this.nodeMap = new Map();

      this.transform = { x: 0, y: 0, scale: 1 };
      this.draggedNode = null;
      this.hoveredNode = null;
      this.isPanning = false;
      this.panStart = { x: 0, y: 0 };
      this.animationFrameId = null;
      this.searchQuery = '';

      this._initEvents();
      this.resize();
    }

    resize() {
      const rect = this.canvas.parentElement ? this.canvas.parentElement.getBoundingClientRect() : { width: 800, height: 600 };
      this.width = rect.width || 800;
      this.height = rect.height || 600;
      this.canvas.width = this.width * window.devicePixelRatio;
      this.canvas.height = this.height * window.devicePixelRatio;
      this.canvas.style.width = this.width + 'px';
      this.canvas.style.height = this.height + 'px';
      this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    _initEvents() {
      window.addEventListener('resize', () => this.resize());

      this.canvas.addEventListener('mousedown', (e) => {
        const mouse = this._getCanvasPoint(e);
        const node = this._findNodeAt(mouse.x, mouse.y);
        if (node) {
          this.draggedNode = node;
          node.isFixed = true;
        } else {
          this.isPanning = true;
          this.panStart = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
        }
      });

      window.addEventListener('mousemove', (e) => {
        if (this.draggedNode) {
          const mouse = this._getCanvasPoint(e);
          this.draggedNode.x = mouse.x;
          this.draggedNode.y = mouse.y;
          this.draggedNode.vx = 0;
          this.draggedNode.vy = 0;
        } else if (this.isPanning) {
          this.transform.x = e.clientX - this.panStart.x;
          this.transform.y = e.clientY - this.panStart.y;
        } else {
          const rect = this.canvas.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
            const mouse = this._getCanvasPoint(e);
            const prevHover = this.hoveredNode;
            this.hoveredNode = this._findNodeAt(mouse.x, mouse.y);
            this.canvas.style.cursor = this.hoveredNode ? 'pointer' : 'grab';
            if (prevHover !== this.hoveredNode && this.options.onNodeHover) {
              this.options.onNodeHover(this.hoveredNode);
            }
          }
        }
      });

      window.addEventListener('mouseup', (e) => {
        if (this.draggedNode) {
          this.draggedNode.isFixed = false;
          this.draggedNode = null;
        }
        this.isPanning = false;
      });

      this.canvas.addEventListener('click', (e) => {
        const mouse = this._getCanvasPoint(e);
        const node = this._findNodeAt(mouse.x, mouse.y);
        if (node && this.options.onNodeClick) {
          this.options.onNodeClick(node);
        }
      });

      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        const mouse = { x: e.offsetX, y: e.offsetY };

        const newScale = Math.max(0.2, Math.min(4, this.transform.scale * zoomFactor));
        this.transform.x = mouse.x - (mouse.x - this.transform.x) * (newScale / this.transform.scale);
        this.transform.y = mouse.y - (mouse.y - this.transform.y) * (newScale / this.transform.scale);
        this.transform.scale = newScale;
      }, { passive: false });
    }

    _getCanvasPoint(e) {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return {
        x: (x - this.transform.x) / this.transform.scale,
        y: (y - this.transform.y) / this.transform.scale
      };
    }

    _findNodeAt(x, y) {
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        const dist = Math.hypot(n.x - x, n.y - y);
        if (dist <= (n.radius || this.options.nodeRadius) + 4) {
          return n;
        }
      }
      return null;
    }

    setData(items = []) {
      this.nodes = [];
      this.edges = [];
      this.nodeMap.clear();

      const tagMap = new Map();
      const domainMap = new Map();

      // 1. Process Item Nodes
      items.forEach((item, idx) => {
        if (item.archived) return;

        const type = item.type || 'url';
        let color = '#7952ff'; // Purple (URL)
        let icon = '🔗';
        if (type === 'note') { color = '#00f2a9'; icon = '📝'; }
        if (type === 'apiKey') { color = '#ffaa00'; icon = '🔑'; }
        if (type === 'password') { color = '#ff3366'; icon = '🔒'; }

        const angle = (idx / Math.max(1, items.length)) * Math.PI * 2;
        const radius = 150 + Math.random() * 120;

        const node = {
          id: 'item_' + (item.id || idx),
          label: item.title || item.name || item.url || 'Untitled',
          type: type,
          item: item,
          color: color,
          icon: icon,
          radius: 12,
          x: this.width / 2 + Math.cos(angle) * radius,
          y: this.height / 2 + Math.sin(angle) * radius,
          vx: 0,
          vy: 0,
          mass: 1.5
        };

        this.nodes.push(node);
        this.nodeMap.set(node.id, node);

        // Track Tags
        (item.tags || []).forEach(t => {
          const cleanTag = t.trim().toLowerCase();
          if (!cleanTag) return;
          if (!tagMap.has(cleanTag)) tagMap.set(cleanTag, []);
          tagMap.get(cleanTag).push(node.id);
        });

        // Track Domains
        if (item.url) {
          try {
            const host = new URL(item.url).hostname.replace(/^www\./, '');
            if (!domainMap.has(host)) domainMap.set(host, []);
            domainMap.get(host).push(node.id);
          } catch (e) {}
        }
      });

      // 2. Add Tag Nodes & Edges
      tagMap.forEach((itemIds, tag) => {
        const tagNodeId = 'tag_' + tag;
        const tagNode = {
          id: tagNodeId,
          label: '#' + tag,
          type: 'tag',
          color: '#00e5ff',
          icon: '🏷️',
          radius: 9 + Math.min(8, itemIds.length * 2),
          x: this.width / 2 + (Math.random() - 0.5) * 300,
          y: this.height / 2 + (Math.random() - 0.5) * 300,
          vx: 0,
          vy: 0,
          mass: 2.0
        };

        this.nodes.push(tagNode);
        this.nodeMap.set(tagNodeId, tagNode);

        itemIds.forEach(itemId => {
          this.edges.push({
            source: this.nodeMap.get(itemId),
            target: tagNode,
            length: this.options.springLength,
            color: 'rgba(0, 229, 255, 0.35)'
          });
        });
      });

      // 3. Add Domain Nodes for clusters with 2+ items
      domainMap.forEach((itemIds, domain) => {
        if (itemIds.length >= 2) {
          const domNodeId = 'dom_' + domain;
          const domNode = {
            id: domNodeId,
            label: domain,
            type: 'domain',
            color: '#c4b5fd',
            icon: '🌐',
            radius: 11,
            x: this.width / 2 + (Math.random() - 0.5) * 400,
            y: this.height / 2 + (Math.random() - 0.5) * 400,
            vx: 0,
            vy: 0,
            mass: 2.2
          };

          this.nodes.push(domNode);
          this.nodeMap.set(domNodeId, domNode);

          itemIds.forEach(itemId => {
            this.edges.push({
              source: this.nodeMap.get(itemId),
              target: domNode,
              length: this.options.springLength * 1.2,
              color: 'rgba(196, 181, 253, 0.25)'
            });
          });
        }
      });

      // Center initial transform
      this.transform = { x: 0, y: 0, scale: 1 };
    }

    setSearchFilter(query) {
      this.searchQuery = (query || '').toLowerCase().trim();
    }

    _stepPhysics() {
      const centerX = this.width / 2;
      const centerY = this.height / 2;

      // 1. Node Repulsion (Coulomb-like)
      for (let i = 0; i < this.nodes.length; i++) {
        const n1 = this.nodes[i];
        for (let j = i + 1; j < this.nodes.length; j++) {
          const n2 = this.nodes[j];
          const dx = n2.x - n1.x;
          const dy = n2.y - n1.y;
          const distSq = dx * dx + dy * dy + 100;
          const dist = Math.sqrt(distSq);

          if (dist < 400) {
            const force = this.options.repulsion / distSq;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!n1.isFixed) { n1.vx -= fx / n1.mass; n1.vy -= fy / n1.mass; }
            if (!n2.isFixed) { n2.vx += fx / n2.mass; n2.vy += fy / n2.mass; }
          }
        }

        // Center Gravity
        if (!n1.isFixed) {
          n1.vx += (centerX - n1.x) * this.options.centerGravity;
          n1.vy += (centerY - n1.y) * this.options.centerGravity;
        }
      }

      // 2. Edge Spring Attraction (Hooke's Law)
      for (const edge of this.edges) {
        if (!edge.source || !edge.target) continue;
        const dx = edge.target.x - edge.source.x;
        const dy = edge.target.y - edge.source.y;
        const dist = Math.hypot(dx, dy) || 1;
        const diff = dist - edge.length;
        const force = diff * this.options.springStrength;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        if (!edge.source.isFixed) { edge.source.vx += fx / edge.source.mass; edge.source.vy += fy / edge.source.mass; }
        if (!edge.target.isFixed) { edge.target.vx -= fx / edge.target.target?.mass || 1; edge.target.vy -= fy / edge.target.target?.mass || 1; }
      }

      // 3. Integrate Velocity & Apply Damping
      for (const n of this.nodes) {
        if (n.isFixed) continue;
        n.vx *= this.options.damping;
        n.vy *= this.options.damping;
        n.x += n.vx;
        n.y += n.vy;
      }
    }

    render() {
      this.ctx.clearRect(0, 0, this.width, this.height);

      this.ctx.save();
      this.ctx.translate(this.transform.x, this.transform.y);
      this.ctx.scale(this.transform.scale, this.transform.scale);

      // 1. Draw Edges
      for (const edge of this.edges) {
        if (!edge.source || !edge.target) continue;
        const isHovered = this.hoveredNode && (this.hoveredNode === edge.source || this.hoveredNode === edge.target);

        this.ctx.beginPath();
        this.ctx.moveTo(edge.source.x, edge.source.y);
        this.ctx.lineTo(edge.target.x, edge.target.y);
        this.ctx.strokeStyle = isHovered ? '#00e5ff' : edge.color;
        this.ctx.lineWidth = isHovered ? 2.5 : 1.2;
        this.ctx.stroke();
      }

      // 2. Draw Nodes
      for (const node of this.nodes) {
        const isHovered = this.hoveredNode === node;
        const isMatch = this.searchQuery && node.label.toLowerCase().includes(this.searchQuery);
        const radius = (node.radius || this.options.nodeRadius) * (isHovered ? 1.3 : (isMatch ? 1.2 : 1.0));

        // Outer Glow
        if (isHovered || isMatch) {
          this.ctx.beginPath();
          this.ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
          this.ctx.fillStyle = node.color + '44';
          this.ctx.fill();
        }

        // Node Circle
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
        this.ctx.fillStyle = node.color;
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = isHovered ? 2.5 : 1.5;
        this.ctx.stroke();

        // Node Icon
        if (radius >= 10) {
          this.ctx.font = `${Math.floor(radius * 0.9)}px sans-serif`;
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText(node.icon || '●', node.x, node.y);
        }

        // Node Label
        const shouldShowLabel = isHovered || isMatch || this.transform.scale > 0.8 || node.type === 'tag';
        if (shouldShowLabel) {
          this.ctx.font = isHovered || isMatch ? '600 12px Plus Jakarta Sans, sans-serif' : '500 10px Plus Jakarta Sans, sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'top';

          // Background box for crisp readability
          const text = node.label.length > 24 ? node.label.substring(0, 22) + '…' : node.label;
          const textMetrics = this.ctx.measureText(text);
          const boxWidth = textMetrics.width + 10;
          const boxHeight = 16;

          this.ctx.fillStyle = 'rgba(7, 7, 10, 0.85)';
          this.ctx.roundRect ? this.ctx.roundRect(node.x - boxWidth / 2, node.y + radius + 4, boxWidth, boxHeight, 4) : this.ctx.fillRect(node.x - boxWidth / 2, node.y + radius + 4, boxWidth, boxHeight);
          this.ctx.fill();

          this.ctx.fillStyle = isHovered || isMatch ? '#ffffff' : '#9ca3af';
          this.ctx.fillText(text, node.x, node.y + radius + 6);
        }
      }

      this.ctx.restore();
    }

    start() {
      const loop = () => {
        this._stepPhysics();
        this.render();
        this.animationFrameId = requestAnimationFrame(loop);
      };
      this.stop();
      this.animationFrameId = requestAnimationFrame(loop);
    }

    stop() {
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }

    destroy() {
      this.stop();
      this.nodes = [];
      this.edges = [];
      this.nodeMap.clear();
    }
  }

  global.KnowledgeGraph = KnowledgeGraph;
})(typeof window !== 'undefined' ? window : globalThis);
