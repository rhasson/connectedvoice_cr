

"use strict";

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _regeneratorRuntime = require('babel-runtime/regenerator')['default'];

var _Object$keys = require('babel-runtime/core-js/object/keys')['default'];

var _ = require('lodash');

var Node = (function () {

  /*:: content: Object;*/
  /*:: root: boolean;*/
  /*:: nodes: any;*/

  function Node(content, root) {
    _classCallCheck(this, Node);

    this.content = content || {};
    this.root = root || false;
    this.nodes = [];
  }

  _createClass(Node, [{
    key: 'isRoot',
    value: function isRoot() /*: boolean*/{
      return this.root;
    }
  }, {
    key: 'addNode',
    value: function addNode(id, /*: string*/node /*: Object*/) {
      this.nodes['_' + id] = node;
    }
  }, {
    key: 'getAllNodes',
    value: function getAllNodes() /*: Object*/{
      return _.values(this.nodes);
    }
  }, {
    key: 'hasNode',
    value: function hasNode(id /*: string*/) /*: boolean*/{
      return !!this.nodes['_' + id];
    }
  }, {
    key: 'setContent',
    value: function setContent(content /*: Object*/) {
      this.content = content;
    }
  }, {
    key: 'appendNodeTo',
    value: function appendNodeTo(to_id, /*: string*/id, /*: string*/node /*: Object*/) {
      var n = this.nodes['_' + to_id];
      n.addNode(id, node);
    }
  }, {
    key: 'get',
    value: function get() /*: Object*/{
      return {
        root: this.root,
        content: this.content,
        nodes: this.nodes
      };
    }
  }]);

  return Node;
})();

var Tree = (function () {

  /*:: idKey: string;*/
  /*:: tree: Object;*/
  /*:: rootId: number;*/
  /*:: currIndex: number;*/

  function Tree(id_key /*: string*/) {
    _classCallCheck(this, Tree);

    this.idKey = id_key || 'index';
    this.tree = {};
    this.rootId = 0;
    this.currIndex = 0;
  }

  _createClass(Tree, [{
    key: 'setRoot',
    value: function setRoot(item /*: Object*/) {
      this.tree[item[this.idKey]] = new Node(item, true);
      this.rootId = item[this.idKey];
    }
  }, {
    key: 'addBranch',
    value: function addBranch(item /*: Object*/) {
      //add a branch to the tree
      var root = this.tree[this.rootId];
      root.addNode(item[this.idKey], new Node(item));
    }
  }, {
    key: 'addNodeToBranch',
    value: function addNodeToBranch(id, /*: number*/node /*: Object*/) {
      var _this = this;

      //add a node to an existing branch
      var root = this.tree[this.rootId];

      var check = function check(id, branch) {
        //console.log('BRANCH: ', branch)
        if (id === branch.content[_this.idKey]) {
          branch.addNode(node[_this.idKey], new Node(node));
        } else if (branch.hasNode(id)) {
          branch.appendNodeTo(id, node[_this.idKey], new Node(node));
        } else {
          var nodes = branch.getAllNodes();
          if (nodes.length > 0) nodes.forEach(function (n) {
            return check(id, n);
          }); //was originally (n, id )
        }
      };

      check(id, root);
    }
  }, {
    key: 'findById',
    value: function findById(path, /*: string*/value /*: any*/) /*: any*/{
      var vals = _.valuesIn(this.tree);
      var ret = undefined;
      var self = this;
      var key = path || this.idKey;

      function find(branch /*:Object*/) /*: any*/{
        var nodes = branch.getAllNodes();
        if (_.get(branch.content, key) === value) {
          ret = branch;
          return;
        }
        for (var i = 0; i < nodes.length; i++) {
          find(nodes[i]);
        }
      }

      for (var i = 0; i < vals.length; i++) {
        find(vals[i]);
      }

      return ret;
    }
  }, {
    key: 'findByHash',
    value: function findByHash(path, /*: string*/value /*: any*/) /*: Object*/{
      return this.findById(path, value);
    }
  }, {
    key: 'findChildrenOfByHash',
    value: function findChildrenOfByHash(path, /*: string*/value, /*: any*/nativeArray /*: boolean*/) /*: Array<Object>*/{
      var node = this.findById(path, value);
      var nodes = node != undefined ? node.getAllNodes() : [];

      if (nativeArray && nodes.length > 0) {
        return nodes.map(function (n) {
          return n.content;
        });
      } else return nodes;
    }
  }, {
    key: 'flatWalk',
    value: _regeneratorRuntime.mark(function flatWalk(branch /*: Object*/) {
      var arr, a, node;
      return _regeneratorRuntime.wrap(function flatWalk$(context$2$0) {
        while (1) switch (context$2$0.prev = context$2$0.next) {
          case 0:
            arr = branch || this.tree;
            context$2$0.t0 = _regeneratorRuntime.keys(arr);

          case 2:
            if ((context$2$0.t1 = context$2$0.t0()).done) {
              context$2$0.next = 11;
              break;
            }

            a = context$2$0.t1.value;
            node = arr[a];
            context$2$0.next = 7;
            return { id: a, node: node.content, children: _Object$keys(node.nodes).length };

          case 7:
            if (!(_Object$keys(node.nodes).length > 0)) {
              context$2$0.next = 9;
              break;
            }

            return context$2$0.delegateYield(this.flatWalk(node.nodes), 't2', 9);

          case 9:
            context$2$0.next = 2;
            break;

          case 11:
          case 'end':
            return context$2$0.stop();
        }
      }, flatWalk, this);
    })
  }]);

  return Tree;
})();

module.exports = Tree;
/*: any*/