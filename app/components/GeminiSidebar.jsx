import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ReactPlannerActions } from 'react-planner';

console.log('GeminiSidebar: PropTypes is', PropTypes);


class GeminiSidebar extends Component {
    constructor(props) {
        super(props);
        this.state = {
            messages: [
                { role: 'system', content: 'Hello! I am your Smart Architect. How can I help you design your floorplan?' }
            ],
            input: '',
            isLoading: false,
            savedViews: []
        };
    }

    handleInputChange = (e) => {
        this.setState({ input: e.target.value });
    }

    handleSaveView = () => {
        const name = `Option ${String.fromCharCode(65 + this.state.savedViews.length)}`;
        this.setState(prevState => ({
            savedViews: [...prevState.savedViews, { name, state: this.props.plannerState }]
        }));
    }

    handleLoadView = (viewState) => {
        this.props.loadProject(viewState);
    }

    handleSend = async () => {
        const { input, messages } = this.state;
        if (!input.trim()) return;

        const newMessages = [...messages, { role: 'user', content: input }];
        this.setState({ messages: newMessages, input: '', isLoading: true });

        // Prepare context
        const sceneContext = JSON.stringify(this.props.plannerState);
        console.log("Sending context to AI:", sceneContext);

        try {
            // Mock AI response for now
            let responseContent = "I received your request. I cannot generate a plan without a real API key yet.";

            if (input.toLowerCase().includes('hello world')) {
                // Generate a simple Hello World layout
                const helloWorldState = this.generateHelloWorldState();
                this.props.loadProject(helloWorldState);
                responseContent = "I have generated a basic 'Hello World' floorplan for you.";
            } else if (input.toLowerCase().includes('variations')) {
                const var1 = this.generateHelloWorldState();
                const var2 = this.generateHelloWorldState();
                // In a real app, these would be different
                this.setState(prevState => ({
                    savedViews: [
                        ...prevState.savedViews,
                        { name: 'AI Variation 1', state: var1 },
                        { name: 'AI Variation 2', state: var2 }
                    ]
                }));
                responseContent = "I have generated 2 variations and saved them to your Blueprints Manager.";
            }

            setTimeout(() => {
                this.setState(prevState => ({
                    messages: [...prevState.messages, { role: 'system', content: responseContent }],
                    isLoading: false
                }));
            }, 1000);

        } catch (error) {
            console.error("Error calling AI:", error);
            this.setState(prevState => ({
                messages: [...prevState.messages, { role: 'system', content: "Error processing request." }],
                isLoading: false
            }));
        }
    }

    generateHelloWorldState() {
        return {
            unit: "cm",
            layers: {
                "layer-1": {
                    id: "layer-1",
                    visible: true,
                    active: true,
                    vertices: {
                        'v1': { id: 'v1', x: 0, y: 0, selected: false, lines: ['l1', 'l4'] },
                        'v2': { id: 'v2', x: 400, y: 0, selected: false, lines: ['l1', 'l2'] },
                        'v3': { id: 'v3', x: 400, y: 400, selected: false, lines: ['l2', 'l3'] },
                        'v4': { id: 'v4', x: 0, y: 400, selected: false, lines: ['l3', 'l4'] }
                    },
                    lines: {
                        'l1': { id: 'l1', type: 'wall', vertices: ['v1', 'v2'], selected: false, holes: [] },
                        'l2': { id: 'l2', type: 'wall', vertices: ['v2', 'v3'], selected: false, holes: [] },
                        'l3': { id: 'l3', type: 'wall', vertices: ['v3', 'v4'], selected: false, holes: [] },
                        'l4': { id: 'l4', type: 'wall', vertices: ['v4', 'v1'], selected: false, holes: [] }
                    },
                    holes: {},
                    areas: {},
                    items: {},
                    selected: { vertices: [], lines: [], holes: [], items: [] }
                }
            },
            width: 3000,
            height: 2000,
            meta: {},
            guides: { horizontal: {}, vertical: {} }
        };
    }

    render() {
        const { messages, input, isLoading, savedViews } = this.state;

        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: '#f5f5f5',
                borderLeft: '1px solid #ddd',
                fontFamily: 'sans-serif',
                boxSizing: 'border-box'
            }}>
                <div style={{ padding: '15px', backgroundColor: '#2c3e50', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Smart Architect</h3>
                    <button onClick={this.handleSaveView} style={{
                        fontSize: '0.8rem', padding: '5px 10px', backgroundColor: '#34495e', color: '#fff', border: '1px solid #7f8c8d', borderRadius: '4px', cursor: 'pointer'
                    }}>Save View</button>
                </div>

                {savedViews.length > 0 && (
                    <div style={{ padding: '10px', backgroundColor: '#ecf0f1', borderBottom: '1px solid #bdc3c7', maxHeight: '150px', overflowY: 'auto' }}>
                        <h4 style={{ margin: '0 0 5px 0', fontSize: '0.9rem', color: '#7f8c8d' }}>Blueprints Manager</h4>
                        {savedViews.map((view, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', backgroundColor: '#fff', padding: '5px', borderRadius: '4px' }}>
                                <span style={{ fontSize: '0.9rem' }}>{view.name}</span>
                                <button onClick={() => this.handleLoadView(view.state)} style={{
                                    fontSize: '0.8rem', padding: '2px 8px', backgroundColor: '#3498db', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer'
                                }}>Load</button>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ flex: 1, overflowY: 'auto', padding: '15px' }}>
                    {messages.map((msg, idx) => (
                        <div key={idx} style={{
                            marginBottom: '15px',
                            textAlign: msg.role === 'user' ? 'right' : 'left'
                        }}>
                            <div style={{
                                display: 'inline-block',
                                padding: '10px 15px',
                                borderRadius: '15px',
                                backgroundColor: msg.role === 'user' ? '#3498db' : '#ecf0f1',
                                color: msg.role === 'user' ? '#fff' : '#2c3e50',
                                maxWidth: '85%',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && <div style={{ color: '#7f8c8d', fontStyle: 'italic' }}>Thinking...</div>}
                </div>
                <div style={{ padding: '15px', borderTop: '1px solid #ddd', display: 'flex', backgroundColor: '#fff' }}>
                    <input
                        type="text"
                        value={input}
                        onChange={this.handleInputChange}
                        onKeyPress={(e) => e.key === 'Enter' && this.handleSend()}
                        placeholder="Describe your floorplan..."
                        style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: '4px',
                            border: '1px solid #bdc3c7',
                            marginRight: '10px',
                            fontSize: '1rem'
                        }}
                    />
                    <button onClick={this.handleSend} style={{
                        padding: '10px 20px',
                        backgroundColor: '#27ae60',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 'bold'
                    }}>
                        Send
                    </button>
                </div>
            </div>
        );
    }
}

GeminiSidebar.propTypes = {
    plannerState: PropTypes.object.isRequired,
    loadProject: PropTypes.func.isRequired
};

const mapStateToProps = (state) => {
    return {
        plannerState: state.get('react-planner').toJS()
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        loadProject: bindActionCreators(ReactPlannerActions.projectActions.loadProject, dispatch)
    };
};

export default connect(mapStateToProps, mapDispatchToProps)(GeminiSidebar);
