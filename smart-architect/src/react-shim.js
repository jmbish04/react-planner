const React = require('../node_modules/react');
const PropTypes = require('prop-types');
const createReactClass = require('create-react-class');

console.log('React Shim: Loaded React', React);
console.log('React Shim: React.Component is', React.Component);

React.PropTypes = PropTypes;
React.createClass = createReactClass;

module.exports = React;
